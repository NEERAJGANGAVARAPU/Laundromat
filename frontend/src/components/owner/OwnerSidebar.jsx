import React from 'react';
import {
  LayoutDashboard,
  BarChart3,
  QrCode,
  Layers,
  Users,
  Activity,
  Sliders,
  ShieldAlert,
  ChevronDown,
  LogOut
} from 'lucide-react';

export default function OwnerSidebar({
  activeNav,
  setActiveNav,
  totalMachines,
  activeCustomersCount,
  onSignOut
}) {
  const handleNavClick = (navId, targetSectionId = null) => {
    setActiveNav(navId);
    if (targetSectionId) {
      setTimeout(() => {
        const el = document.getElementById(targetSectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  return (
    <aside className="dashboard-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-wrap">
        <div className="brand-logo-lockup">
          <div className="sidebar-brand-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
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
          <div className="brand-text-col">
            <span className="sidebar-brand-title">Spin &amp; Stay</span>
            <span className="sidebar-brand-sub">OWNER PORTAL</span>
          </div>
        </div>
      </div>

      {/* Location selector */}
      <div className="sidebar-location-card">
        <div className="loc-text">
          <span className="loc-name">Main Street</span>
          <span className="loc-city">San Francisco, CA</span>
        </div>
        <ChevronDown size={16} className="loc-chevron" />
      </div>

      {/* Nav Menu */}
      <nav className="sidebar-nav">
        <button
          className={`nav-item-btn ${activeNav === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveNav('overview')}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>

        <button
          className={`nav-item-btn ${activeNav === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveNav('reports')}
        >
          <BarChart3 size={18} />
          <span>Reports</span>
        </button>

        <button
          className={`nav-item-btn ${activeNav === 'qr' ? 'active' : ''}`}
          onClick={() => handleNavClick('overview', 'qr-section')}
        >
          <QrCode size={18} />
          <span>QR labels</span>
        </button>

        <button
          className={`nav-item-btn ${activeNav === 'machines' ? 'active' : ''}`}
          onClick={() => handleNavClick('overview', 'machines-section')}
        >
          <Layers size={18} />
          <span>Machines</span>
          <span className="nav-badge">{totalMachines}</span>
        </button>

        <button
          className={`nav-item-btn ${activeNav === 'customers' ? 'active' : ''}`}
          onClick={() => handleNavClick('overview', 'sessions-section')}
        >
          <Users size={18} />
          <span>Customers</span>
          <span className="nav-badge">{activeCustomersCount}</span>
        </button>

        <button
          className={`nav-item-btn ${activeNav === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveNav('activity')}
        >
          <Activity size={18} />
          <span>Activity</span>
        </button>

        <div className="nav-group-label">WORKSPACE</div>

        <button
          className={`nav-item-btn ${activeNav === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveNav('settings')}
        >
          <Sliders size={18} />
          <span>Access settings</span>
        </button>

        <button
          className={`nav-item-btn ${activeNav === 'security' ? 'active' : ''}`}
          onClick={() => setActiveNav('security')}
        >
          <ShieldAlert size={18} />
          <span>Sessions &amp; security</span>
        </button>
      </nav>

      {/* Sidebar Bottom Banner & Profile */}
      <div className="sidebar-footer-wrap">
        <div className="sidebar-info-box">
          <h5 className="info-box-title">Your owner workspace</h5>
          <p className="info-box-text">A separate view for operations, customer records and access.</p>
        </div>

        <div className="owner-profile-row">
          <div className="owner-avatar">VK</div>
          <div className="owner-profile-info">
            <span className="owner-name">Vikranth</span>
            <span className="owner-role">Store owner</span>
          </div>
          <button className="signout-btn" onClick={onSignOut} title="Sign out">
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
