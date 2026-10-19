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

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const cleanUser = username.trim().toLowerCase();
      // Accepts 'vikranth' or 'vikranth@spinandstay.co' or 'jordan@spinandstay.co'
      const isValidUser = cleanUser === 'vikranth' || cleanUser.startsWith('vikranth@') || cleanUser === 'jordan@spinandstay.co';
      const isValidPass = password === 'vikranth@123';

      if (isValidUser && isValidPass) {
        setIsLoading(false);
        localStorage.setItem('spin_owner_auth', JSON.stringify({
          username: cleanUser,
          name: cleanUser === 'vikranth' ? 'Vikranth Chary' : 'Jordan Lee',
          role: 'Store owner',
          loginTime: new Date().toISOString()
        }));
        if (onLogin) onLogin();
        navigate('/owner/dashboard');
      } else {
        setIsLoading(false);
        setError('Invalid owner credentials. Please use username: vikranth and password: vikranth@123');
      }
    }, 400);
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
            <span className="brand-title">Spin &amp; Stay</span>
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
          <span>SPIN &amp; STAY &nbsp;/&nbsp; WASH CLUB</span>
          <Link to="/" className="back-to-customer-link">← Switch to Customer View</Link>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="login-right-panel">
        <div className="right-top-bar">
          <span className="workspace-label">OWNER WORKSPACE</span>
          <span className="preview-pill">Design preview</span>
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
              <label className="field-label">Username or Email</label>
              <div className="owner-input-wrapper">
                <Mail size={18} className="field-icon" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="vikranth"
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
                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Password for this demo: vikranth@123'); }} className="forgot-pass-link">
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

          <p className="bottom-disclaimer">
            Static design preview. Pre-configured for user: <strong>vikranth</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
