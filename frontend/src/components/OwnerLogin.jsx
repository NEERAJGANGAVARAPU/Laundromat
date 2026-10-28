import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, LayoutGrid, Check } from 'lucide-react';
import '../OwnerPortal.css';

export default function OwnerLogin({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const cleanUser = username.trim().toLowerCase();
    const host = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? '127.0.0.1'
      : window.location.hostname;

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
        loginTime: data.user.login_time || new Date().toISOString()
      }));
      if (onLogin) onLogin();
      navigate('/owner/dashboard');
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Unable to connect to authentication server. Please check backend.');
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
            <span className="brand-title">Spinzone</span>
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

            {/* Left floating badge (sentence) */}
            <div className="floating-badge badge-left">
              <LayoutGrid size={15} color="#2558EA" />
              <span>Made for the everyday overview</span>
            </div>

            {/* Right floating badge (sentence) */}
            <div className="floating-badge badge-right">
              <span className="cyan-dot"></span>
              <span>Keep the day flowing.</span>
            </div>
          </div>
        </div>

        <div className="login-left-footer">
          <span>SPINZONE</span>
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
          {/* Key Icon */}
          <div className="key-icon-wrapper">
            <KeyRound size={22} className="key-icon" />
          </div>

          <h2 className="login-title">Welcome back, owner.</h2>
          <p className="login-subtitle">
            Sign in with your invited owner account to continue to your management workspace.
          </p>

          {error && <div className="login-error-banner">{error}</div>}

          <form onSubmit={handleSubmit} className="owner-form">
            {/* Username / Email field */}
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

            {/* Password field */}
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
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert(`To recover owner access, sign in using your system administrator credentials configured in the server environment (.env), or reset it from the Owner Dashboard.`);
                  }}
                  className="forgot-pass-link"
                >
                  Forgot password?
                </a>
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
              <span>Next step: account verification after sign-in.</span>
            </div>

            {/* Invitation-only Callout */}
            <div className="invite-callout">
              <h4 className="invite-title">Owner access is invitation-only.</h4>
              <p className="invite-desc">
                Need access? Contact your account administrator. This portal is separate from customer check-in.
              </p>
            </div>
          </form>

          <div className="login-powered-by-footer">
            <span className="powered-by-text">Powered by:</span>
            <img src="/sanielsoft_full_logo.png" alt="SanielSoft" className="sanielsoft-logo-img" />
          </div>
        </div>
      </div>
    </div>
  );
}
