import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  LayoutGrid,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import '../OwnerPortal.css';

export default function OwnerLogin({ onLogin }) {
  const navigate = useNavigate();

  // Mode: 'password' | 'forgot_request' | 'forgot_otp'
  const [authMode, setAuthMode] = useState('password');

  // Form states
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmailHint, setOtpEmailHint] = useState('');

  // Status states
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getApiHost = () => {
    return (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? '127.0.0.1'
      : window.location.hostname;
  };

  // 1. Regular Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setIsLoading(true);

    const cleanUser = username.trim().toLowerCase();
    const host = getApiHost();

    try {
      let res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password })
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`http://${host}:8000/api/auth/login/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid owner credentials. Please verify your username and password.');
      }

      setIsLoading(false);
      localStorage.setItem('spin_owner_auth', JSON.stringify({
        username: data.user.username,
        name: 'Store Admin',
        role: data.user.role || 'Store owner',
        loginTime: data.user.login_time || new Date().toISOString(),
        logged_in_via_otp: false
      }));
      sessionStorage.removeItem('spin_owner_logged_in_via_otp');

      if (onLogin) onLogin();
      navigate('/owner/dashboard');
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Unable to connect to authentication server. Please check backend.');
    }
  };

  // 2. Request OTP for Forgot Password
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');
    setIsLoading(true);

    const cleanUser = username.trim().toLowerCase() || 'admin';
    const host = getApiHost();

    try {
      let res = await fetch('/api/auth/forgot-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser })
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`http://${host}:8000/api/auth/forgot-password/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to request OTP. Please verify your recovery email.');
      }

      setIsLoading(false);
      setOtpEmailHint(data.email_hint || '');
      setInfoMessage(data.message || 'A 6-digit OTP has been sent to your registered email.');
      setAuthMode('forgot_otp');
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Failed to send OTP. Please check recovery email configuration.');
    }
  };

  // 3. Verify OTP & Log In
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setIsLoading(true);

    const cleanUser = username.trim().toLowerCase() || 'admin';
    const cleanOtp = otpCode.trim();
    const host = getApiHost();

    try {
      let res = await fetch('/api/auth/verify-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, otp: cleanOtp })
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`http://${host}:8000/api/auth/verify-otp/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, otp: cleanOtp })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired OTP code.');
      }

      setIsLoading(false);
      // Mark logged_in_via_otp as true so dashboard knows to display the "Wanna change your password?" card!
      localStorage.setItem('spin_owner_auth', JSON.stringify({
        username: data.user.username,
        name: 'Store Admin',
        role: data.user.role || 'Store owner',
        loginTime: data.user.login_time || new Date().toISOString(),
        logged_in_via_otp: true
      }));
      sessionStorage.setItem('spin_owner_logged_in_via_otp', 'true');

      if (onLogin) onLogin();
      navigate('/owner/dashboard');
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'OTP verification failed. Please try again.');
    }
  };

  return (
    <div className="owner-login-container">
      {/* Left Brand Panel */}
      <div className="login-left-panel">
        <div className="brand-header-left">
          <Link to="/" className="login-logo-link">
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
            <span className="brand-title">SanielSoft ai</span>
          </Link>
        </div>

        <div className="login-hero-content">
          <div className="owner-portal-tag">THE OWNER PORTAL</div>
          <h1 className="hero-headline">
            A little more clarity.<br />
            A little less admin.
          </h1>
          <p className="hero-subtext">
            Your machines, your customers, your daily rhythm.<br />
            One dedicated space to oversee it all.
          </p>

          {/* Center Graphic */}
          <div className="hero-graphic-wrap">
            <div className="navy-concentric-circle">
              <svg viewBox="0 0 100 100" className="large-wave-svg">
                <path
                  d="M20 40C32 25 40 25 50 40C60 55 68 55 80 40"
                  stroke="#2558EA"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M20 60C32 45 40 45 50 60C60 75 68 75 80 60"
                  stroke="#2558EA"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>

            {/* Left floating badge */}
            <div className="floating-badge badge-left">
              <LayoutGrid size={15} color="#2558EA" />
              <span>Made for the everyday overview</span>
            </div>

            {/* Right floating badge */}
            <div className="floating-badge badge-right">
              <span className="cyan-dot"></span>
              <span>Keep the day flowing.</span>
            </div>
          </div>
        </div>

        <div className="login-left-footer">
          <span>SANIELSOFT AI</span>
          <div className="powered-by-brand-mini">
            <span className="powered-by-text-light">Powered by:</span>
            <img src="/sanielsoft_full_logo.png" alt="SanielSoft" className="sanielsoft-logo-img-sm" />
          </div>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="login-right-panel">
        <div className="right-top-bar">
          <span className="workspace-label">OWNER WORKSPACE</span>
        </div>

        <div className="login-card-center">
          {/* ================= MODE 1: STANDARD PASSWORD LOGIN ================= */}
          {authMode === 'password' && (
            <>
              <div className="key-icon-wrapper">
                <KeyRound size={22} className="key-icon" />
              </div>

              <h2 className="login-title">Welcome back, owner.</h2>
              <p className="login-subtitle">
                Sign in with your invited owner account to continue to your management workspace.
              </p>

              {error && <div className="login-error-banner">{error}</div>}

              <form onSubmit={handlePasswordLogin} className="owner-form">
                {/* Username */}
                <div className="form-field-group">
                  <label className="field-label">Username</label>
                  <div className="owner-input-wrapper">
                    <Mail size={18} className="field-icon" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="form-field-group">
                  <div className="label-with-forgot">
                    <label className="field-label">Password</label>
                  </div>
                  <div className="owner-input-wrapper">
                    <Lock size={18} className="field-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                    />
                    <button
                      type="button"
                      className="eye-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="forgot-pass-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setInfoMessage('');
                        setAuthMode('forgot_request');
                      }}
                      className="forgot-pass-link-btn"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button type="submit" className="owner-submit-btn" disabled={isLoading}>
                  <span>{isLoading ? 'Verifying...' : 'Sign in to owner portal'}</span>
                  <ArrowRight size={18} />
                </button>

                {/* Sub note */}
                <div className="next-step-note">
                  <ShieldCheck size={16} className="note-shield" />
                  <span>Google email verification configured for account safety.</span>
                </div>

                {/* Invitation Callout */}
                <div className="invite-callout">
                  <h4 className="invite-title">Owner access is invitation-only.</h4>
                  <p className="invite-desc">
                    Need access? Contact your account administrator. This portal is separate from customer check-in.
                  </p>
                </div>
              </form>
            </>
          )}

          {/* ================= MODE 2: REQUEST OTP (FORGOT PASSWORD) ================= */}
          {authMode === 'forgot_request' && (
            <>
              <div className="key-icon-wrapper" style={{ background: 'rgba(37, 88, 234, 0.12)' }}>
                <KeyRound size={22} className="key-icon" style={{ color: '#2558EA' }} />
              </div>

              <h2 className="login-title">Reset with OTP</h2>
              <p className="login-subtitle">
                Enter your admin username. We will send a 6-digit one-time code to your verified Google recovery email.
              </p>

              {error && <div className="login-error-banner">{error}</div>}

              <form onSubmit={handleRequestOtp} className="owner-form">
                <div className="form-field-group">
                  <label className="field-label">Username</label>
                  <div className="owner-input-wrapper">
                    <Mail size={18} className="field-icon" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter admin username"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="owner-submit-btn" disabled={isLoading}>
                  <span>{isLoading ? 'Sending OTP to email...' : 'Send Login OTP'}</span>
                  <ArrowRight size={18} />
                </button>

                <div className="otp-actions-row">
                  <button
                    type="button"
                    className="back-to-login-btn"
                    onClick={() => {
                      setError('');
                      setInfoMessage('');
                      setAuthMode('password');
                    }}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to password sign in</span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ================= MODE 3: ENTER OTP ================= */}
          {authMode === 'forgot_otp' && (
            <>
              <div className="key-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
                <ShieldCheck size={22} className="key-icon" style={{ color: '#059669' }} />
              </div>

              <h2 className="login-title">Enter 6-digit OTP</h2>
              <p className="login-subtitle">
                {otpEmailHint
                  ? `We've sent a 6-digit verification code to ${otpEmailHint}.`
                  : 'Enter the 6-digit one-time password sent to your recovery email.'}
              </p>

              {infoMessage && (
                <div className="login-info-banner">
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{infoMessage}</span>
                </div>
              )}

              {error && <div className="login-error-banner">{error}</div>}

              <form onSubmit={handleVerifyOtp} className="owner-form">
                <div className="form-field-group">
                  <label className="field-label">One-Time Password (OTP)</label>
                  <div className="owner-input-wrapper">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      className="otp-code-input"
                      autoFocus
                      required
                    />
                  </div>
                  <span className="otp-code-hint">Code is valid for 10 minutes</span>
                </div>

                <button
                  type="submit"
                  className="owner-submit-btn"
                  disabled={isLoading || otpCode.length !== 6}
                >
                  <span>{isLoading ? 'Verifying OTP...' : 'Verify OTP & Sign In'}</span>
                  <ArrowRight size={18} />
                </button>

                <div className="otp-resend-row">
                  <button
                    type="button"
                    className="resend-otp-btn"
                    onClick={handleRequestOtp}
                    disabled={isLoading}
                  >
                    <RefreshCw size={14} />
                    <span>Resend OTP code</span>
                  </button>

                  <button
                    type="button"
                    className="back-to-login-btn"
                    onClick={() => {
                      setError('');
                      setInfoMessage('');
                      setAuthMode('password');
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to password</span>
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="login-powered-by-footer">
            <span className="powered-by-text">Powered by:</span>
            <img src="/sanielsoft_full_logo.png" alt="SanielSoft" className="sanielsoft-logo-img" />
          </div>
        </div>
      </div>
    </div>
  );
}
