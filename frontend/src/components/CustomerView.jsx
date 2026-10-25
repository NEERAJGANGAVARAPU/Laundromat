import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Check,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Bell,
  Play,
  Info,
  ShoppingBag,
  ChevronLeft,
  RotateCcw,
  Shield,
  AlertCircle
} from 'lucide-react';
import '../App.css';

export default function CustomerView() {
  // Check if an active session was previously running on this client
  const savedTargetEnd = localStorage.getItem('active_session_target_end');
  const initialRemaining = savedTargetEnd
    ? Math.max(0, Math.floor((parseInt(savedTargetEnd, 10) - Date.now()) / 1000))
    : null;
  const hasActiveLocalSession = initialRemaining !== null && initialRemaining > 0;
  const savedTotalSecs = localStorage.getItem('active_session_total_secs');
  const initialTotalSecs = savedTotalSecs ? parseInt(savedTotalSecs, 10) : 40 * 60;
  const savedDuration = localStorage.getItem('active_session_duration');
  const initialDuration = savedDuration ? parseInt(savedDuration, 10) : 40;
  const savedCode = localStorage.getItem('active_session_code');

  // Navigation / Flow state: 1 = Check In, 2 = Set Timer, 3 = Running, 4 = Time to Head Back (<= 5 min)
  const [step, setStep] = useState(() => {
    if (hasActiveLocalSession) {
      return initialRemaining <= 300 ? 4 : 3;
    }
    return 1;
  });

  // Form states - initialize immediately from QR parameter or saved active session
  const [machineCode, setMachineCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('machine');
    return m ? m.toUpperCase() : (savedCode || 'W-1');
  });
  const [machineType, setMachineType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('machine');
    const code = m ? m.toUpperCase() : (savedCode || 'W-1');
    return code.startsWith('D') ? 'dryer' : 'washer';
  });
  const [name, setName] = useState(() => localStorage.getItem('active_customer_name') || '');
  const [email, setEmail] = useState(() => localStorage.getItem('active_customer_email') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('active_customer_phone') || '');
  const [formErrors, setFormErrors] = useState({});

  // Backend machines state
  const [availableMachines, setAvailableMachines] = useState([]);
  const [backendConnected, setBackendConnected] = useState(false);

  // Timer states
  const [duration, setDuration] = useState(initialDuration); // in minutes
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [customInput, setCustomInput] = useState(String(initialDuration));
  const [totalSeconds, setTotalSeconds] = useState(initialTotalSecs);
  const [secondsRemaining, setSecondsRemaining] = useState(hasActiveLocalSession ? initialRemaining : initialDuration * 60);
  const [isRunning, setIsRunning] = useState(hasActiveLocalSession);
  const [notifPermission, setNotifPermission] = useState('default');
  const [acknowledgedHeadBack, setAcknowledgedHeadBack] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(() => localStorage.getItem('active_session_id') || null);

  // Dynamic API host (works on laptop 127.0.0.1 and mobile Wi-Fi)
  const apiHost = window.location.hostname || '127.0.0.1';

  // Resilient API Fetch (tries relative Vite proxy first, then direct Django port 8000)
  const apiFetch = async (endpoint, options = {}) => {
    try {
      const res = await fetch(endpoint, options);
      if (res && res.ok) return res;
    } catch (e) {}
    return fetch(`http://${apiHost}:8000${endpoint}`, options);
  };

  // Fetch machines and handle QR code parameter / refresh resilience
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const scannedCode = urlParams.get('machine');

    apiFetch('/api/machines/')
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableMachines(data);
          setBackendConnected(true);

          const targetCode = scannedCode || localStorage.getItem('active_session_code');
          let matched = null;

          if (targetCode) {
            matched = data.find(
              (m) => m.machine_code.toLowerCase() === targetCode.toLowerCase()
            );
          }

          if (matched) {
            setMachineCode(matched.machine_code);
            setMachineType(matched.machine_type);

            if (matched.active_session_id) {
              setActiveSessionId(matched.active_session_id);
              localStorage.setItem('active_session_id', matched.active_session_id);
            }

            // REFRESH RESILIENCE: Prioritize server-side seconds_remaining (drift-free)
            const serverSecondsRemaining = typeof matched.seconds_remaining === 'number' ? matched.seconds_remaining : null;
            const serverTotalSecs = matched.total_seconds || (matched.minutes_remaining ? matched.minutes_remaining * 60 : 0);

            // Compute fallback remaining seconds from target_end or expected_end_at
            let effectiveRemaining = serverSecondsRemaining;
            if (effectiveRemaining === null || effectiveRemaining <= 0) {
              const savedEnd = localStorage.getItem('active_session_target_end');
              if (savedEnd) {
                const localRem = Math.max(0, Math.floor((parseInt(savedEnd, 10) - Date.now()) / 1000));
                if (localRem > 0) {
                  effectiveRemaining = localRem;
                }
              }
            }

            if (matched.status === 'in_use' && (effectiveRemaining === null || effectiveRemaining <= 0) && matched.expected_end_at) {
              const endMs = new Date(matched.expected_end_at).getTime();
              const nowMs = Date.now();
              const diff = Math.floor((endMs - nowMs) / 1000);
              if (diff > 0) {
                effectiveRemaining = diff;
              }
            }

            if (effectiveRemaining !== null && effectiveRemaining > 0) {
              const finalTotalSecs = serverTotalSecs > 0 ? serverTotalSecs : Math.max(effectiveRemaining, initialTotalSecs);
              const finalDuration = Math.ceil(finalTotalSecs / 60);

              setDuration(finalDuration);
              setTotalSeconds(finalTotalSecs);
              setSecondsRemaining(effectiveRemaining);
              setIsRunning(true);
              setStep(effectiveRemaining <= 300 ? 4 : 3);

              // Update client target end aligned with remaining time
              const updatedTargetEnd = Date.now() + effectiveRemaining * 1000;
              localStorage.setItem('active_session_target_end', String(updatedTargetEnd));
              localStorage.setItem('active_session_total_secs', String(finalTotalSecs));
              localStorage.setItem('active_session_duration', String(finalDuration));
              return;
            } else if (matched.status === 'in_use' && (!effectiveRemaining || effectiveRemaining <= 0)) {
              setSecondsRemaining(0);
              setIsRunning(false);
              setStep(4);
              localStorage.removeItem('active_session_target_end');
              return;
            }
            return;
          }

          // Fallback to first washer if no valid machine scanned
          const firstWasher = data.find((m) => m.machine_type === 'washer');
          if (firstWasher) {
            setMachineCode(firstWasher.machine_code);
            setMachineType('washer');
          }
        }
      })
      .catch((err) => {
        console.warn('Backend fetch error:', err);
        if (scannedCode) {
          setMachineCode(scannedCode.toUpperCase());
          if (scannedCode.toUpperCase().startsWith('D')) setMachineType('dryer');
        }
        setBackendConnected(false);
      });

    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, [apiHost]);

  // Live Timer Countdown Interval - calculates against target timestamp to prevent drift
  useEffect(() => {
    let timerId = null;
    if (isRunning && secondsRemaining > 0) {
      timerId = setInterval(() => {
        const savedEnd = localStorage.getItem('active_session_target_end');
        let next;
        if (savedEnd) {
          next = Math.max(0, Math.floor((parseInt(savedEnd, 10) - Date.now()) / 1000));
        } else {
          next = secondsRemaining - 1;
        }

        setSecondsRemaining(next);

        if (next <= 300 && step === 3) {
          setStep(4);
          triggerNotification('Time to head back!', `${name || 'Alex'}, you have 5 minutes left on your wash.`);
          playChime();
        }

        if (next <= 0) {
          clearInterval(timerId);
          setIsRunning(false);
          localStorage.removeItem('active_session_target_end');
          triggerNotification('Wash Complete!', `${name || 'Alex'}, your wash is finished.`);
          playChime();

          // Notify backend that session is complete to free the machine
          if (activeSessionId) {
            apiFetch(`/api/sessions/${activeSessionId}/complete/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            }).catch((err) => console.warn('Complete session error:', err));
          }
        }
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning, step, name, activeSessionId, apiHost]);

  // Tab focus / lock screen resume sync
  useEffect(() => {
    const handleSyncOnFocus = () => {
      const savedEnd = localStorage.getItem('active_session_target_end');
      if (savedEnd) {
        const rem = Math.max(0, Math.floor((parseInt(savedEnd, 10) - Date.now()) / 1000));
        setSecondsRemaining(rem);
        if (rem <= 0 && isRunning) {
          setIsRunning(false);
          setStep(4);
          localStorage.removeItem('active_session_target_end');
        } else if (rem <= 300 && step === 3) {
          setStep(4);
        }
      }
    };

    document.addEventListener('visibilitychange', handleSyncOnFocus);
    window.addEventListener('focus', handleSyncOnFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleSyncOnFocus);
      window.removeEventListener('focus', handleSyncOnFocus);
    };
  }, [isRunning, step]);

  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {
      // Audio not permitted
    }
  };

  const triggerNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.png' });
      } catch (err) {
        console.log(err);
      }
    }
  };

  const handleRequestNotif = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  };

  const handlePhoneChange = (e) => {
    // Only allow numeric digits and enforce max 10 digits
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digitsOnly);
    if (formErrors.phone) {
      setFormErrors((prev) => ({ ...prev, phone: null }));
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (formErrors.email) {
      setFormErrors((prev) => ({ ...prev, email: null }));
    }
  };

  const validateAndProceedToTimer = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validate Email
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errors.email = 'Please provide an email address for cycle completion notifications.';
    } else if (!cleanEmail.includes('@') || !emailRegex.test(cleanEmail)) {
      errors.email = 'Please enter a valid email address containing "@" and a domain (e.g. name@example.com).';
    }

    // Validate Phone: must be exactly 10 digits
    const digitsOnly = phone.replace(/\D/g, '');
    if (!digitsOnly) {
      errors.phone = 'Please provide your 10-digit phone number.';
    } else if (digitsOnly.length !== 10) {
      errors.phone = `Phone number must be exactly 10 digits (currently ${digitsOnly.length}/10 digits entered).`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setStep(2);
  };

  const handleStartTimer = async () => {
    setIsBooking(true);
    setBookingError(null);

    // Ensure typed duration is used
    let finalDuration = duration;
    if (isEditingDuration && customInput) {
      const parsed = parseInt(customInput, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 180) {
        finalDuration = parsed;
        setDuration(parsed);
      }
    }

    try {
      // 1. Send atomic reservation request to Django backend
      const res = await apiFetch('/api/sessions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_code: machineCode,
          customer_name: name || '',
          customer_email: email || 'customer@laundromat.local',
          customer_phone: phone || '',
          duration_minutes: finalDuration,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      console.log('✅ Session created in Django database:', data);
      localStorage.setItem('active_session_code', machineCode);
      if (data.id) {
        setActiveSessionId(data.id);
        localStorage.setItem('active_session_id', data.id);
      }
      if (name) localStorage.setItem('active_customer_name', name);
      if (email) localStorage.setItem('active_customer_email', email);
      if (phone) localStorage.setItem('active_customer_phone', phone);

      // 2. Start the live countdown timer from server duration
      const totalSecsVal = (data.duration_minutes || finalDuration) * 60;
      const initialSecs = typeof data.seconds_remaining === 'number' && data.seconds_remaining > 0
        ? data.seconds_remaining
        : totalSecsVal;
      const targetEnd = Date.now() + initialSecs * 1000;

      localStorage.setItem('active_session_target_end', String(targetEnd));
      localStorage.setItem('active_session_total_secs', String(totalSecsVal));
      localStorage.setItem('active_session_duration', String(data.duration_minutes || finalDuration));

      setTotalSeconds(totalSecsVal);
      setSecondsRemaining(initialSecs);
      setIsRunning(true);
      setAcknowledgedHeadBack(false);

      if (initialSecs <= 300) {
        setStep(4);
      } else {
        setStep(3);
      }
    } catch (err) {
      alert(`Reservation Failed: ${err.message}`);
      setBookingError(err.message);
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelTimer = async () => {
    setIsRunning(false);
    setSecondsRemaining(0);
    setStep(2);

    localStorage.removeItem('active_session_id');
    localStorage.removeItem('active_session_code');
    localStorage.removeItem('active_session_target_end');
    localStorage.removeItem('active_session_total_secs');
    localStorage.removeItem('active_session_duration');

    const sessId = activeSessionId || localStorage.getItem('active_session_id');
    if (sessId) {
      try {
        await apiFetch(`/api/sessions/${sessId}/cancel/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.warn('Backend cancel error:', err);
      }
      setActiveSessionId(null);
    }
  };


  const handleQuickDuration = (min) => {
    setDuration(min);
    setCustomInput(String(min));
    setIsEditingDuration(false);
  };

  const handleSaveCustomDuration = () => {
    const parsed = parseInt(customInput, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 180) {
      setDuration(parsed);
      setIsEditingDuration(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const gaugeRadius = 125;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const progressPercent = totalSeconds > 0 ? (totalSeconds - secondsRemaining) / totalSeconds : 0;
  const strokeDashoffset = gaugeCircumference * (1 - progressPercent);

  const firstName = name.trim().split(' ')[0] || 'Alex';

  return (
    <div className="page-wrapper">
      <div className="app-card">
        {/* Navigation Bar */}
        <header className="brand-header">
          <div className="logo-group" onClick={() => setStep(1)} style={{ cursor: 'pointer' }}>
            <div className="brand-icon">
              <svg viewBox="0 0 32 32" fill="none" className="wave-svg">
                <circle cx="16" cy="16" r="14.5" stroke="#2558EA" strokeWidth="2.5" />
                <path
                  d="M9 13.5C11.5 10.5 13.5 10.5 16 13.5C18.5 16.5 20.5 16.5 23 13.5"
                  stroke="#2558EA"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M9 18.5C11.5 15.5 13.5 15.5 16 18.5C18.5 21.5 20.5 21.5 23 18.5"
                  stroke="#2558EA"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="brand-title">Spinzone</h1>
          </div>
        </header>

        {/* 3-segment progress bar */}
        <div className="stepper-bar">
          <div className={`bar-segment ${step >= 1 ? 'active' : ''}`} />
          <div className={`bar-segment ${step >= 2 ? 'active' : ''}`} />
          <div className={`bar-segment ${step >= 3 ? 'active' : ''}`} />
        </div>

        {/* ================= STEP 01: CHECK IN ================= */}
        {step === 1 && (
          <main className="content-step">
            <div className="heading-with-machine-row">
              <div className="heading-left-col">
                <div className="step-tag">01 / CHECK IN</div>
                <h2 className="main-heading">
                  Fresh laundry.<br />
                  Less waiting.
                </h2>
              </div>

              {/* Scanned Machine Image Badge next to the Fresh Laundry Quote */}
              <div
                className={`scanned-machine-badge-next-to-quote ${machineType === 'washer' ? 'badge-washer' : 'badge-dryer'}`}
                title={`Selected ${machineType === 'washer' ? 'Washing Machine' : 'Dryer'} (${machineCode})`}
              >
                <div className="badge-icon-bubble">
                  {machineType === 'washer' ? (
                    <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
                      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="3.2" />
                      <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="2.5" />
                      <circle cx="24" cy="24" r="4.5" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
                      <rect x="12" y="14" width="24" height="3.5" rx="1.75" fill="currentColor" />
                      <rect x="9" y="22" width="30" height="4" rx="2" fill="currentColor" />
                      <rect x="12" y="30" width="24" height="3.5" rx="1.75" fill="currentColor" />
                    </svg>
                  )}
                </div>
                <span className="badge-machine-tag">{machineCode}</span>
                <span className="badge-machine-name">{machineType === 'washer' ? 'Washer' : 'Dryer'}</span>
              </div>
            </div>

            <p className="main-subtext">
              You're in the right place. Check in, set a timer and make the wait your own.
            </p>

            <div className="trust-badge">
              <CheckCircle2 size={18} className="trust-icon" />
              <span>No account. No password. Just your wash.</span>
            </div>

            {/* Machine field with Thank-You Alert & Cards (Only in Form Tab) */}
            <div className="machine-field-section">
              {/* Thank you message banner */}
              <div className={`thankyou-machine-banner ${machineType === 'washer' ? 'is-washer' : 'is-dryer'}`}>
                <div className="thankyou-icon-circle">
                  {machineType === 'washer' ? (
                    <svg viewBox="0 0 48 48" width="26" height="26" fill="none">
                      <circle cx="24" cy="24" r="18" stroke="#2558EA" strokeWidth="3" />
                      <circle cx="24" cy="24" r="11" stroke="#2558EA" strokeWidth="2.5" />
                      <circle cx="24" cy="24" r="4.5" fill="#2558EA" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 48 48" width="26" height="26" fill="none">
                      <rect x="12" y="14" width="24" height="3.5" rx="1.75" fill="#0284c7" />
                      <rect x="9" y="22" width="30" height="4" rx="2" fill="#0284c7" />
                      <rect x="12" y="30" width="24" height="3.5" rx="1.75" fill="#0284c7" />
                    </svg>
                  )}
                </div>
                <div className="thankyou-text-col">
                  <h4 className="thankyou-headline">
                    Thank you for selecting {machineType === 'washer' ? 'Washer' : 'the dryer'}
                  </h4>
                  <p className="thankyou-subline">
                    Machine <strong>{machineCode}</strong> is configured for your session.
                  </p>
                </div>
              </div>

            </div>

            <div className="form-section">
              {/* Form Input: Name */}
              <div className="input-group">
                <label className="input-label">Your name</label>
                <div className="input-card">
                  <User size={20} className="input-icon" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                  />
                </div>
              </div>

              {/* Form Input: Email */}
              <div className="input-group">
                <label className="input-label">Email address</label>
                <div className="input-card" style={formErrors.email ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}>
                  <Mail size={20} className="input-icon" style={formErrors.email ? { color: '#ef4444' } : {}} />
                  <input
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="alex.morgan@example.com"
                  />
                </div>
                {formErrors.email ? (
                  <span style={{ color: '#dc2626', fontSize: '12.5px', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} /> {formErrors.email}
                  </span>
                ) : (
                  <span className="helper-note">We'll email you the moment your cycle finishes.</span>
                )}
              </div>

              {/* Form Input: Phone */}
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="input-label">Phone number (10 digits only)</label>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: phone.length === 10 ? '#059669' : '#64748b' }}>
                    {phone.length}/10 digits
                  </span>
                </div>
                <div className="input-card" style={formErrors.phone ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}>
                  <Phone size={20} className="input-icon" style={formErrors.phone ? { color: '#ef4444' } : {}} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="e.g. 9876543210"
                    maxLength={10}
                  />
                </div>
                {formErrors.phone ? (
                  <span style={{ color: '#dc2626', fontSize: '12.5px', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} /> {formErrors.phone}
                  </span>
                ) : (
                  <span className="helper-note">Please enter a valid 10-digit mobile number (numbers only).</span>
                )}
              </div>
            </div>

            {/* Privacy notice */}
            <div className="privacy-card">
              <ShieldCheck size={20} className="privacy-icon" />
              <p>
                Your details are for this wash, not marketing. This preview doesn't save or send your information.
              </p>
            </div>

            {/* Continue button */}
            <button className="primary-btn royal-blue-btn" onClick={validateAndProceedToTimer}>
              <span>Continue to timer</span>
              <ArrowRight size={20} />
            </button>
          </main>
        )}

        {/* ================= STEP 02: SET YOUR TIMER ================= */}
        {step === 2 && (
          <main className="content-step">
            <div className="step-tag-row">
              <button className="back-link-btn" onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Edit check in
              </button>
              <div className="step-tag">02 / SET YOUR TIMER</div>
            </div>

            <h2 className="main-heading">
              How long's<br />
              your wash, {firstName}?
            </h2>
            <p className="main-subtext">
              Match the time on your machine. We'll show a collection reminder with 5 minutes to go.
            </p>

            <div className="duration-section">
              <div className="duration-header">
                <span className="duration-label">Wash duration</span>
                <span className="duration-sub">Choose or enter any time</span>
              </div>

              {/* Quick Pills: 20 min, 30 min, 40 min, 60 min */}
              <div className="pills-row">
                {[20, 30, 40, 60].map((min) => (
                  <button
                    key={min}
                    type="button"
                    className={`duration-pill ${duration === min && !isEditingDuration ? 'active' : ''}`}
                    onClick={() => handleQuickDuration(min)}
                  >
                    <span className="num">{min}</span>
                    <span className="unit">min</span>
                  </button>
                ))}
              </div>

              {/* Custom Duration Big Display / Edit */}
              <div className="custom-duration-card">
                <span className="custom-hint">Or set a custom duration</span>
                {isEditingDuration ? (
                  <div className="edit-box-row">
                    <input
                      type="number"
                      className="custom-input-box"
                      value={customInput}
                      onChange={(e) => {
                        setCustomInput(e.target.value);
                        const parsed = parseInt(e.target.value, 10);
                        if (!isNaN(parsed) && parsed > 0 && parsed <= 180) {
                          setDuration(parsed);
                        }
                      }}
                      min="1"
                      max="180"
                      autoFocus
                    />
                    <span className="custom-unit-text">minutes</span>
                    <button className="save-btn" onClick={handleSaveCustomDuration}>
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="duration-display-row">
                    <span className="big-duration-num">{duration}</span>
                    <span className="big-duration-unit">minutes</span>
                    <button className="edit-text-btn" onClick={() => setIsEditingDuration(true)}>
                      EDIT
                    </button>
                  </div>
                )}
              </div>

              {/* Bell reminder calculation */}
              <div className="reminder-line">
                <Bell size={18} className="reminder-bell-icon" />
                <span>
                  {duration}-minute {machineType === 'washer' ? 'wash' : 'dry'} · reminder after{' '}
                  {Math.max(1, duration - 5)} minutes
                </span>
              </div>
            </div>

            {/* Error banner if reservation failed */}
            {bookingError && (
              <div style={{ color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '14px' }}>
                ⚠️ {bookingError}
              </div>
            )}

            {/* Start Timer Button */}
            <button className="primary-btn navy-btn" onClick={handleStartTimer} disabled={isBooking}>
              <span>{isBooking ? 'Reserving machine...' : `Start my ${duration}-minute timer`}</span>
              <Play size={18} fill="currentColor" />
            </button>
            <p className="sub-button-hint">Start your machine first. This timer won't control it.</p>
          </main>
        )}

        {/* ================= STEP 03: ACTIVE TIMER (RUNNING) ================= */}
        {step === 3 && (
          <main className="content-step">
            <div className="step-tag">03 / A LITTLE TIME FOR YOU</div>
            <h2 className="main-heading">
              Let it spin, {firstName}.
            </h2>
            <p className="main-subtext">
              Your {duration}-minute timer is running. Grab a coffee, read a chapter, take a breather.
            </p>

            {/* Circular Gauge */}
            <div className="gauge-container">
              <svg className="gauge-svg" width="280" height="280" viewBox="0 0 300 300">
                <circle
                  cx="150"
                  cy="150"
                  r={gaugeRadius}
                  className="gauge-bg-circle"
                  strokeWidth="16"
                  fill="none"
                />
                <circle
                  cx="150"
                  cy="150"
                  r={gaugeRadius}
                  className="gauge-progress-circle"
                  strokeWidth="16"
                  fill="none"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 150 150)"
                />
              </svg>

              <div className="gauge-center-content">
                <span className="gauge-status-label">WASH IN PROGRESS</span>
                <span className="gauge-timer-digits">{formatTime(secondsRemaining)}</span>
                <span className="gauge-sublabel">minutes remaining</span>
              </div>
            </div>

            {/* Quick stats box */}
            <div className="stats-box">
              <div className="stat-col">
                <span className="stat-title">Your wash</span>
                <span className="stat-val">{duration} minutes</span>
              </div>
              <div className="stat-col text-right">
                <span className="stat-title">Collection reminder</span>
                <span className="stat-val blue-highlight">At 05:00 left</span>
              </div>
            </div>

            {/* Keep page open notice */}
            <div className="info-callout">
              <Info size={20} className="info-icon" />
              <p>Keep this page open to see your countdown and the on-screen collection reminder.</p>
            </div>

            {/* Demo / Test helper button to jump to 5 min state */}
            <div className="demo-toolbar">
              <button
                className="demo-pill-btn"
                onClick={() => {
                  const demoRem = 300;
                  setSecondsRemaining(demoRem);
                  setStep(4);
                  localStorage.setItem('active_session_target_end', String(Date.now() + demoRem * 1000));
                  playChime();
                }}
              >
                Fast-forward to 5 min left (Screen 4 Demo)
              </button>
            </div>

            {/* Cancel Button */}
            <button className="cancel-timer-btn" onClick={handleCancelTimer}>
              Cancel timer
            </button>
          </main>
        )}

        {/* ================= STEP 04: COLLECTION REMINDER (<= 5 MIN) & COMPLETION ================= */}
        {step === 4 && (
          <main className="content-step">
            <div className="step-tag">
              {secondsRemaining > 0 ? '03 / TIME TO HEAD BACK' : '04 / WASH COMPLETED'}
            </div>
            <h2 className="main-heading">
              {secondsRemaining > 0 ? (
                <>Nearly fresh.<br />Nearly finished.</>
              ) : (
                <>Clean & Fresh.<br />Ready to unload.</>
              )}
            </h2>
            <p className="main-subtext">
              {secondsRemaining > 0
                ? `${firstName}, your wash has ${Math.ceil(secondsRemaining / 60)} minutes left. Make your way back to collect your clothes.`
                : `${firstName}, your wash on machine ${machineCode} is complete! You can unload your clothes or start your next batch.`}
            </p>

            {/* Circular Gauge */}
            <div className="gauge-container">
              <svg className="gauge-svg" width="280" height="280" viewBox="0 0 300 300">
                <circle
                  cx="150"
                  cy="150"
                  r={gaugeRadius}
                  className="gauge-bg-circle"
                  strokeWidth="16"
                  fill="none"
                />
                <circle
                  cx="150"
                  cy="150"
                  r={gaugeRadius}
                  className={`gauge-progress-circle ${secondsRemaining > 0 ? 'reminder-ring' : 'complete-ring'}`}
                  strokeWidth="16"
                  fill="none"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 150 150)"
                />
              </svg>

              <div className="gauge-center-content">
                <span className={`gauge-status-label ${secondsRemaining > 0 ? 'collection-active' : 'complete-active'}`}>
                  {secondsRemaining > 0 ? 'COLLECTION REMINDER' : 'CYCLE COMPLETE'}
                </span>
                <span className="gauge-timer-digits">{formatTime(secondsRemaining)}</span>
                <span className="gauge-sublabel">
                  {secondsRemaining > 0 ? 'minutes remaining' : 'wash is done'}
                </span>
              </div>
            </div>

            {/* Stats box */}
            <div className="stats-box">
              <div className="stat-col">
                <span className="stat-title">Your wash</span>
                <span className="stat-val">{duration} minutes</span>
              </div>
              <div className="stat-col text-right">
                <span className="stat-title">Wash status</span>
                <span className="stat-val blue-highlight">
                  {secondsRemaining > 0
                    ? (secondsRemaining <= 60 ? `In ${secondsRemaining}s` : `In ${Math.ceil(secondsRemaining / 60)} minutes`)
                    : 'Completed'}
                </span>
              </div>
            </div>

            {/* Bring laundry bag card */}
            <div className="laundry-bag-card">
              <div className="bag-icon-col">
                <ShoppingBag size={24} className="bag-icon" />
              </div>
              <div className="bag-text-col">
                <h4 className="bag-title">
                  {secondsRemaining > 0 ? 'Bring your laundry bag along.' : 'Ready for unload.'}
                </h4>
                <p className="bag-desc">
                  {secondsRemaining > 0
                    ? 'Check your machine before unloading. This reminder follows your timer, not the machine.'
                    : `Please unload machine ${machineCode} promptly so it is free for other users or your next batch.`}
                </p>
              </div>
            </div>

            {/* WHILE RUNNING: Show On My Way + Cancel Timer (Early cancellation only) */}
            {secondsRemaining > 0 ? (
              <>
                <button
                  className={`primary-btn navy-btn ${acknowledgedHeadBack ? 'btn-acknowledged' : ''}`}
                  onClick={() => setAcknowledgedHeadBack(true)}
                >
                  <span>{acknowledgedHeadBack ? "Acknowledged! We're waiting" : "Got it, I'm on my way"}</span>
                  <Check size={20} />
                </button>
                <p className="sub-button-hint">Your countdown continues until the wash ends.</p>

                {/* Cancel Timer Button: ONLY early cancellation while active */}
                <button className="cancel-timer-btn" onClick={handleCancelTimer}>
                  Cancel timer
                </button>
              </>
            ) : (
              /* ONCE COMPLETED: Show Start Another Wash (for batch 2!) */
              <>
                <button
                  className="primary-btn navy-btn"
                  onClick={() => {
                    localStorage.removeItem('active_session_id');
                    localStorage.removeItem('active_session_code');
                    localStorage.removeItem('active_session_target_end');
                    localStorage.removeItem('active_session_total_secs');
                    localStorage.removeItem('active_session_duration');
                    setActiveSessionId(null);
                    setIsRunning(false);
                    setSecondsRemaining(0);
                    setStep(2); // Go to setup screen to wash next batch!
                  }}
                >
                  <RotateCcw size={18} style={{ display: 'inline', marginRight: '8px' }} />
                  <span>Start another wash (Next batch)</span>
                </button>
                <p className="sub-button-hint">
                  Your machine is unlocked. You can start your next batch or switch machines!
                </p>
              </>
            )}
          </main>
        )}

        {/* Global App Footer */}
        <footer className="app-footer">
          <span className="footer-slogan">A little less waiting. A little more you.</span>
        </footer>

        {/* Powered by SanielSoft inside mobile card rectangle */}
        <div className="customer-powered-by-wrap">
          <span className="customer-powered-label">Powered by:</span>
          <img
            src="/sanielsoft_full_logo.png"
            alt="SanielSoft"
            className="sanielsoft-logo-customer"
          />
        </div>
      </div>
    </div>
  );
}
