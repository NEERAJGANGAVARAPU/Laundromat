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
  ExternalLink,
  ChevronLeft,
  RotateCcw,
  Shield
} from 'lucide-react';
import '../App.css';

export default function CustomerView() {
  // Navigation / Flow state: 1 = Check In, 2 = Set Timer, 3 = Running, 4 = Time to Head Back (<= 5 min)
  const [step, setStep] = useState(1);

  // Form states
  const [machineType, setMachineType] = useState('washer'); // 'washer' | 'dryer'
  const [machineCode, setMachineCode] = useState('W-1');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Backend machines state
  const [availableMachines, setAvailableMachines] = useState([]);
  const [backendConnected, setBackendConnected] = useState(false);

  // Timer states
  const [duration, setDuration] = useState(40); // in minutes
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [customInput, setCustomInput] = useState('40');
  const [totalSeconds, setTotalSeconds] = useState(40 * 60);
  const [secondsRemaining, setSecondsRemaining] = useState(40 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');
  const [acknowledgedHeadBack, setAcknowledgedHeadBack] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  // Dynamic API host (works on laptop 127.0.0.1 and mobile Wi-Fi)
  const apiHost = window.location.hostname || '127.0.0.1';

  // Fetch machines and handle QR code parameter / refresh resilience
  useEffect(() => {
    const apiUrl = `http://${apiHost}:8000/api/machines/`;
    const urlParams = new URLSearchParams(window.location.search);
    const scannedCode = urlParams.get('machine');

    fetch(apiUrl)
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

            // REFRESH RESILIENCE: If machine has an active session, resume countdown!
            if (matched.expected_end_at) {
              const endMs = new Date(matched.expected_end_at).getTime();
              const nowMs = Date.now();
              const remainingSecs = Math.max(0, Math.floor((endMs - nowMs) / 1000));

              if (remainingSecs > 0) {
                const estDuration = matched.minutes_remaining || Math.ceil(remainingSecs / 60);
                setDuration(estDuration);
                setTotalSeconds(Math.max(remainingSecs, estDuration * 60));
                setSecondsRemaining(remainingSecs);
                setIsRunning(true);
                setStep(remainingSecs <= 300 ? 4 : 3);
                return;
              } else if (matched.status === 'in_use') {
                setSecondsRemaining(0);
                setIsRunning(false);
                setStep(4);
                return;
              }
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

  // Timer countdown interval
  useEffect(() => {
    let timerId = null;
    if (isRunning && secondsRemaining > 0) {
      timerId = setInterval(() => {
        setSecondsRemaining((prev) => {
          const next = prev - 1;
          if (next <= 300 && step === 3) {
            setStep(4);
            triggerNotification('Time to head back!', `${name || 'Alex'}, you have 5 minutes left on your wash.`);
            playChime();
          }
          if (next <= 0) {
            clearInterval(timerId);
            setIsRunning(false);
            triggerNotification('Wash Complete!', `${name || 'Alex'}, your wash is finished.`);
            playChime();
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning, secondsRemaining, step, name]);

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

  const handleStartTimer = async () => {
    setIsBooking(true);
    setBookingError(null);

    const apiUrl = `http://${apiHost}:8000/api/sessions/`;

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
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_code: machineCode,
          customer_email: email || 'customer@laundromat.local',
          duration_minutes: finalDuration,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      console.log('✅ Session created in Django database:', data);
      localStorage.setItem('active_session_code', machineCode);

      // 2. Start the live countdown timer from server duration
      const secs = finalDuration * 60;
      setTotalSeconds(secs);
      setSecondsRemaining(secs);
      setIsRunning(true);
      setAcknowledgedHeadBack(false);

      if (secs <= 300) {
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

  const handleCancelTimer = () => {
    setIsRunning(false);
    setStep(2);
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
      {/* Top simulated browser pill */}
      <div className="browser-header-pill">
        <span className="lock-icon">🔒</span> spinandstay.co / wash
      </div>

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
            <h1 className="brand-title">Spin &amp; Stay</h1>
          </div>

          <div className="club-badge">WASH CLUB</div>
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
            <div className="step-tag">01 / CHECK IN</div>
            <h2 className="main-heading">
              Fresh laundry.<br />
              Less waiting.
            </h2>
            <p className="main-subtext">
              You're in the right place. Check in, set a timer and make the wait your own.
            </p>

            <div className="trust-badge">
              <CheckCircle2 size={18} className="trust-icon" />
              <span>No account. No password. Just your wash.</span>
            </div>

            {/* Connected machine info from QR code scan */}
            <div className="backend-machines-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="api-dot" style={{ backgroundColor: backendConnected ? '#10B981' : '#F59E0B' }} />
                <span>
                  {backendConnected ? 'Connected to Django' : 'Local Mode'}: <strong>Machine {machineCode}</strong> ({machineType === 'washer' ? 'Washing Machine' : 'Dryer'})
                </span>
              </div>
              <span style={{ fontSize: '12px', opacity: 0.8, background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                Scanned via QR
              </span>
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
                <div className="input-card">
                  <Mail size={20} className="input-icon" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex.morgan@example.com"
                  />
                </div>
              </div>

              {/* Form Input: Phone */}
              <div className="input-group">
                <label className="input-label">Phone number</label>
                <div className="input-card">
                  <Phone size={20} className="input-icon" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(415) 555-0128"
                  />
                </div>
                <span className="helper-note">Include your country code if you're visiting from abroad.</span>
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
            <button className="primary-btn royal-blue-btn" onClick={() => setStep(2)}>
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

            {/* Want browser heads up? */}
            <div className="notification-card">
              <div className="notif-header">
                <Bell size={20} className="notif-bell" />
                <h4 className="notif-title">Want a browser heads-up?</h4>
              </div>
              <p className="notif-text">
                {notifPermission === 'granted'
                  ? 'Browser notifications are enabled! We will alert you with 5 minutes to go.'
                  : "Allow notifications in your browser for a reminder. Permission hasn't been requested yet."}
              </p>
              {notifPermission !== 'granted' && (
                <button type="button" className="notif-enable-btn" onClick={handleRequestNotif}>
                  <span>Enable notifications</span>
                  <ExternalLink size={16} />
                </button>
              )}
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

            {/* Browser notification heads-up if not enabled */}
            {notifPermission !== 'granted' && (
              <div className="notification-card">
                <div className="notif-header">
                  <Bell size={20} className="notif-bell" />
                  <h4 className="notif-title">Want a browser heads-up?</h4>
                </div>
                <p className="notif-text">
                  Allow notifications in your browser for a reminder. Permission hasn't been requested yet.
                </p>
                <button type="button" className="notif-enable-btn" onClick={handleRequestNotif}>
                  <span>Enable notifications</span>
                  <ExternalLink size={16} />
                </button>
              </div>
            )}

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
                  setSecondsRemaining(300);
                  setStep(4);
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

        {/* ================= STEP 04: COLLECTION REMINDER (<= 5 MIN) ================= */}
        {step === 4 && (
          <main className="content-step">
            <div className="step-tag">03 / TIME TO HEAD BACK</div>
            <h2 className="main-heading">
              Nearly fresh.<br />
              Nearly finished.
            </h2>
            <p className="main-subtext">
              {firstName}, your wash has 5 minutes left. Make your way back to collect your clothes.
            </p>

            {/* Circular Gauge in 5 minute reminder state */}
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
                  className="gauge-progress-circle reminder-ring"
                  strokeWidth="16"
                  fill="none"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 150 150)"
                />
              </svg>

              <div className="gauge-center-content">
                <span className="gauge-status-label collection-active">COLLECTION REMINDER</span>
                <span className="gauge-timer-digits">{formatTime(secondsRemaining)}</span>
                <span className="gauge-sublabel">minutes remaining</span>
              </div>
            </div>

            {/* Stats box */}
            <div className="stats-box">
              <div className="stat-col">
                <span className="stat-title">Your wash</span>
                <span className="stat-val">{duration} minutes</span>
              </div>
              <div className="stat-col text-right">
                <span className="stat-title">Wash ends</span>
                <span className="stat-val blue-highlight">
                  {secondsRemaining <= 60
                    ? `In ${secondsRemaining}s`
                    : `In ${Math.ceil(secondsRemaining / 60)} minutes`}
                </span>
              </div>
            </div>

            {/* Bring laundry bag card */}
            <div className="laundry-bag-card">
              <div className="bag-icon-col">
                <ShoppingBag size={24} className="bag-icon" />
              </div>
              <div className="bag-text-col">
                <h4 className="bag-title">Bring your laundry bag along.</h4>
                <p className="bag-desc">
                  Check your machine before unloading. This reminder follows your timer, not the machine.
                </p>
              </div>
            </div>

            {/* Acknowledged / On my way button */}
            <button
              className={`primary-btn navy-btn ${acknowledgedHeadBack ? 'btn-acknowledged' : ''}`}
              onClick={() => setAcknowledgedHeadBack(true)}
            >
              <span>{acknowledgedHeadBack ? "Acknowledged! We're waiting" : "Got it, I'm on my way"}</span>
              <Check size={20} />
            </button>
            <p className="sub-button-hint">Your countdown continues until the wash ends.</p>

            {/* Reset / Start another session */}
            <button
              className="cancel-timer-btn"
              style={{ marginTop: '20px' }}
              onClick={() => {
                setIsRunning(false);
                setStep(1);
              }}
            >
              <RotateCcw size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Start another wash
            </button>
          </main>
        )}

        {/* Global App Footer with Owner portal link */}
        <footer className="app-footer">
          <span className="footer-slogan">A little less waiting. A little more you.</span>
          <div className="footer-links-group" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <a href="#help" className="footer-help-link">Need help?</a>
            <span style={{ opacity: 0.4 }}>•</span>
            <Link to="/owner/login" className="footer-help-link" style={{ fontWeight: 600, color: '#2558EA' }}>
              Owner portal
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
