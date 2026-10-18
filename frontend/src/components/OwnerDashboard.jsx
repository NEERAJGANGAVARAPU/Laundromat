
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  LayoutDashboard,
  QrCode,
  Layers,
  Users,
  Activity,
  Sliders,
  ShieldAlert,
  LogOut,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Printer,
  ChevronDown,
  Trash2,
  Wrench,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import '../OwnerPortal.css';

// Initial default machines matching Image 2
const INITIAL_MACHINES = [
  { id: 'W-01', code: 'W-01', type: 'washer', status: 'occupied', timeRemaining: 18, customer: 'Alex Morgan', service: 'Wash', note: 'Standard wash cycle' },
  { id: 'W-02', code: 'W-02', type: 'washer', status: 'occupied', timeRemaining: 7, customer: 'Priya Shah', service: 'Wash', note: 'Delicate cycle' },
  { id: 'W-03', code: 'W-03', type: 'washer', status: 'available', timeRemaining: 0, customer: null, service: 'Wash', note: 'Newly added washer · ready for print' },
  { id: 'W-04', code: 'W-04', type: 'washer', status: 'maintenance', timeRemaining: 0, customer: null, service: 'Wash', note: 'Door seal inspection' },
  { id: 'D-01', code: 'D-01', type: 'dryer', status: 'occupied', timeRemaining: 12, customer: 'Sam Rivera', service: 'Dry', note: 'Medium heat dry' },
  { id: 'D-02', code: 'D-02', type: 'dryer', status: 'occupied', timeRemaining: 24, customer: 'Jamie Chen', service: 'Dry', note: 'High heat dry' },
  { id: 'D-03', code: 'D-03', type: 'dryer', status: 'available', timeRemaining: 0, customer: null, service: 'Dry', note: 'Ready for a load' },
  { id: 'D-04', code: 'D-04', type: 'dryer', status: 'available', timeRemaining: 0, customer: null, service: 'Dry', note: 'Ready for a load' }
];

export default function OwnerDashboard() {
  const navigate = useNavigate();

  // Navigation tab in sidebar
  const [activeNav, setActiveNav] = useState('overview');

  // Machines state (fetched live from Django API)
  const [machines, setMachines] = useState([]);
  // Customers state (fetched live from Django API)
  const [customers, setCustomers] = useState([]);

  // Filters
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'washer', 'dryer'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'available', 'occupied', 'maintenance'
  const [searchQuery, setSearchQuery] = useState('');

  // QR Code Generation
  const [selectedQrMachine, setSelectedQrMachine] = useState('W-1');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Add Machine Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState('washer');
  const [newStatus, setNewStatus] = useState('available');
  const [newNote, setNewNote] = useState('');

  // Selected Machine Details Modal
  const [selectedDetailMachine, setSelectedDetailMachine] = useState(null);

  // Dynamic API host
  const apiHost = window.location.hostname || '127.0.0.1';
  const [detectedLanIp, setDetectedLanIp] = useState('');

  // Auto-detect active network IP from Django
  useEffect(() => {
    const fetchIp = async () => {
      try {
        let res = await fetch('/api/network-ip/').catch(() => null);
        if (!res || !res.ok) {
          res = await fetch(`http://${apiHost}:8000/api/network-ip/`);
        }
        if (res.ok) {
          const data = await res.json();
          if (data.ip) setDetectedLanIp(data.ip);
        }
      } catch (e) {
        console.warn('Network IP detection error:', e);
      }
    };
    fetchIp();
  }, [apiHost]);

  // Fetch live machines from Django backend
  const fetchBackendMachines = async () => {
    try {
      let res = await fetch('/api/machines/').catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/machines/`);
      }
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped = data.map((m) => ({
          id: m.machine_code,
          code: m.machine_code,
          type: m.machine_type,
          status: m.status === 'in_use' ? 'occupied' : m.status,
          timeRemaining: m.minutes_remaining || 0,
          customer: m.status === 'in_use' ? 'Wash in progress' : null,
          service: m.machine_type === 'washer' ? 'Wash' : 'Dry',
          note: m.status === 'maintenance' ? 'Under inspection / maintenance' : `${m.machine_type === 'washer' ? 'Washer' : 'Dryer'} ready for use`
        }));
        setMachines(mapped);
        if (mapped.length > 0 && !selectedQrMachine) {
          setSelectedQrMachine(mapped[0].code);
        }
      }
    } catch (err) {
      console.warn('Could not load machines from Django:', err);
    }
  };

  // Fetch live sessions from Django backend
  const fetchBackendSessions = async () => {
    try {
      let res = await fetch('/api/sessions/').catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/sessions/`);
      }
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped = data.map((s) => {
          const emailParts = s.customer_email.split('@');
          const maskedEmail = emailParts[0].slice(0, 1) + '•••@' + (emailParts[1] || 'example.com');
          const realPhone = s.customer_phone || 'Not provided';
          const maskedPhone = s.customer_phone
            ? (s.customer_phone.length > 4 ? `••• ••• ${s.customer_phone.slice(-4)}` : s.customer_phone)
            : 'Not provided';
          const displayName = s.customer_name || s.customer_email.split('@')[0];

          return {
            id: s.id,
            name: displayName,
            initials: displayName.slice(0, 2).toUpperCase(),
            email: maskedEmail,
            realEmail: s.customer_email,
            phone: maskedPhone,
            realPhone: realPhone,
            machine: s.machine_code,
            service: s.machine_type === 'dryer' ? 'Dry' : 'Wash',
            timeRemaining: s.status === 'active' ? 'Active in progress' : s.status,
            status: s.status,
            revealed: false
          };
        });

        // Preserve revealed toggles across background poll updates
        setCustomers((prev) => {
          const revealedMap = {};
          prev.forEach((c) => {
            if (c.revealed) revealedMap[c.id] = true;
          });
          return mapped.map((item) => ({
            ...item,
            revealed: !!revealedMap[item.id]
          }));
        });
      }
    } catch (err) {
      console.warn('Could not load sessions from Django:', err);
    }
  };

  // Poll live data on mount
  useEffect(() => {
    fetchBackendMachines();
    fetchBackendSessions();
    const interval = setInterval(() => {
      fetchBackendMachines();
      fetchBackendSessions();
    }, 4000); // 4-second real-time poll
    return () => clearInterval(interval);
  }, [apiHost]);

  // Generate QR Code for selected machine
  useEffect(() => {
    const target = machines.find((m) => m.code === selectedQrMachine) || machines[0];
    if (target) {
      // Automatically use detected Wi-Fi IP so phones scanning from Wi-Fi connect instantly on any network
      const host = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? (detectedLanIp || window.location.hostname)
        : window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';
      const checkinUrl = `http://${host}${port}/?machine=${target.code}`;

      QRCode.toDataURL(checkinUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: '#0B1A44',
          light: '#FFFFFF'
        }
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error(err));
    }
  }, [selectedQrMachine, machines, detectedLanIp]);

  // Logout handler
  const handleSignOut = () => {
    localStorage.removeItem('spin_owner_auth');
    navigate('/owner/login');
  };

  // Add Machine handler (Calls Django POST /api/machines/)
  const handleAddMachine = async (e) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    const formattedCode = newCode.trim().toUpperCase();

    try {
      const res = await fetch(`http://${apiHost}:8000/api/machines/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_code: formattedCode,
          machine_type: newType,
          status: newStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.machine_code?.[0] || data.error || 'Failed to create machine');

      setSelectedQrMachine(formattedCode);
      setIsAddModalOpen(false);
      setNewCode('');
      setNewNote('');
      fetchBackendMachines();
    } catch (err) {
      alert(`Error creating machine: ${err.message}`);
    }
  };

  // Toggle Maintenance handler (Calls Django PATCH /api/machines/<code/ )
  const handleToggleMaintenance = async (machineCode) => {
    const current = machines.find((m) => m.code === machineCode);
    const nextStatus = current?.status === 'maintenance' ? 'available' : 'maintenance';

    try {
      await fetch(`http://${apiHost}:8000/api/machines/${machineCode}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      fetchBackendMachines();
    } catch (err) {
      console.warn('Failed to toggle maintenance on backend:', err);
    }
  };

  // Remove/Deactivate Machine handler (Calls Django DELETE /api/machines/<code/ )
  const handleRemoveMachine = async (machineCode) => {
    if (!window.confirm(`Are you sure you want to deactivate machine ${machineCode}?`)) return;

    try {
      await fetch(`http://${apiHost}:8000/api/machines/${machineCode}/`, {
        method: 'DELETE'
      });
      fetchBackendMachines();
      if (selectedQrMachine === machineCode) {
        setSelectedQrMachine(machines[0]?.code || 'W-1');
      }
    } catch (err) {
      console.warn('Failed to deactivate machine on backend:', err);
    }
  };

  // Toggle Contact Masking
  const toggleContactReveal = (id) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, revealed: !c.revealed } : c))
    );
  };

  // Print QR Label
  const handlePrintLabel = () => {
    window.print();
  };

  // Metrics calculation
  const totalMachines = machines.length;
  const availableCount = machines.filter((m) => m.status === 'available').length;
  const occupiedCount = machines.filter((m) => m.status === 'occupied').length;
  const maintenanceCount = machines.filter((m) => m.status === 'maintenance').length;

  const washers = machines.filter((m) => m.type === 'washer');
  const dryers = machines.filter((m) => m.type === 'dryer');

  const occupiedWashers = washers.filter((m) => m.status === 'occupied').length;
  const availableWashers = washers.filter((m) => m.status === 'available').length;
  const maintenanceWashers = washers.filter((m) => m.status === 'maintenance').length;

  const occupiedDryers = dryers.filter((m) => m.status === 'occupied').length;
  const availableDryers = dryers.filter((m) => m.status === 'available').length;

  // Filtered machines for display
  const filteredMachines = machines.filter((m) => {
    const matchesType = typeFilter === 'all' || m.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesSearch =
      m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.customer && m.customer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.note && m.note.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesStatus && matchesSearch;
  });

  const selectedMachineObj = machines.find((m) => m.code === selectedQrMachine) || machines[0];

  return (
    <div className="dashboard-layout">
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="owner-sidebar">
        {/* Brand */}
        <div className="sidebar-brand-box">
          <div className="sidebar-brand-left">
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
            className={`nav-item-btn ${activeNav === 'qr' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('qr');
              const el = document.getElementById('qr-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <QrCode size={18} />
            <span>QR labels</span>
          </button>

          <button
            className={`nav-item-btn ${activeNav === 'machines' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('machines');
              const el = document.getElementById('machines-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Layers size={18} />
            <span>Machines</span>
            <span className="nav-badge">{totalMachines}</span>
          </button>

          <button
            className={`nav-item-btn ${activeNav === 'customers' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('customers');
              const el = document.getElementById('sessions-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Users size={18} />
            <span>Customers</span>
            <span className="nav-badge">{customers.length}</span>
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
            <button className="signout-btn" onClick={handleSignOut} title="Sign out">
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN DASHBOARD CONTENT ================= */}
      <main className="dashboard-main">
        {/* Top Header Bar */}
        <header className="main-topbar">
          <div className="breadcrumbs">
            <span>Owner portal</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">Overview</span>
          </div>

          <div className="topbar-right">
            <span className="demo-pill">• Live portal</span>
            <span className="current-date-text">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
            <Link to="/" className="switch-customer-btn">
              <ExternalLink size={14} /> Customer view
            </Link>
          </div>
        </header>

        {/* Title & Action Section */}
        <div className="dashboard-title-row">
          <div>
            <h1 className="dash-heading">The day, at a glance.</h1>
            <p className="dash-subheading">
              Main Street overview - {totalMachines} machines across wash and dry.
            </p>
          </div>

          <button className="add-machine-btn" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} />
            <span>Add machine</span>
          </button>
        </div>

        {/* ================= 4 METRICS KPI CARDS ================= */}
        <div className="kpi-grid">
          {/* Card 1: Available Now */}
          <div className="kpi-card">
            <span className="kpi-label">Available now</span>
            <div className="kpi-value-row">
              <span className="kpi-big-num">{availableCount}</span>
              <span className="kpi-total-num">/ {totalMachines} machines</span>
            </div>
            <span className="kpi-footer-text">
              {availableWashers} washer · {availableDryers} dryers ready
            </span>
          </div>

          {/* Card 2: Washer Occupancy */}
          <div className="kpi-card">
            <span className="kpi-label">Washer occupancy</span>
            <div className="kpi-value-row">
              <span className="kpi-big-num">{occupiedWashers}</span>
              <span className="kpi-total-num">/ {washers.length} occupied</span>
            </div>
            <div className="segmented-bar">
              {washers.map((w, i) => (
                <div
                  key={w.code}
                  className={`bar-chunk ${w.status === 'occupied' ? 'chunk-blue' : w.status === 'maintenance' ? 'chunk-orange' : 'chunk-light'
                    }`}
                />
              ))}
            </div>
            <span className="kpi-footer-text">
              {availableWashers} available · {maintenanceWashers} maintenance
            </span>
          </div>

          {/* Card 3: Dryer Occupancy */}
          <div className="kpi-card">
            <span className="kpi-label">Dryer occupancy</span>
            <div className="kpi-value-row">
              <span className="kpi-big-num">{occupiedDryers}</span>
              <span className="kpi-total-num">/ {dryers.length} occupied</span>
            </div>
            <div className="segmented-bar">
              {dryers.map((d, i) => (
                <div
                  key={d.code}
                  className={`bar-chunk ${d.status === 'occupied' ? 'chunk-blue' : d.status === 'maintenance' ? 'chunk-orange' : 'chunk-light'
                    }`}
                />
              ))}
            </div>
            <span className="kpi-footer-text">
              {availableDryers} available · 0 maintenance
            </span>
          </div>

          {/* Card 4: Active Customers */}
          <div className="kpi-card">
            <span className="kpi-label">Active customers</span>
            <div className="kpi-value-row">
              <span className="kpi-big-num">{occupiedCount}</span>
              <span className="kpi-total-num">sessions</span>
            </div>
            <span className="kpi-footer-text">
              {occupiedWashers} washing · {occupiedDryers} drying
            </span>
          </div>
        </div>

        {/* ================= MACHINE FLOOR SECTION ================= */}
        <section id="machines-section" className="dash-section">
          <div className="section-header-row">
            <div className="section-title-group">
              <h2 className="section-title">Machine floor</h2>
              <span className="section-count-badge">{totalMachines} machines</span>
            </div>

            <div className="status-legend">
              <span className="legend-item"><span className="legend-dot dot-green" /> Available {availableCount}</span>
              <span className="legend-item"><span className="legend-dot dot-blue" /> Occupied {occupiedCount}</span>
              <span className="legend-item"><span className="legend-dot dot-orange" /> Maintenance {maintenanceCount}</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="machine-filter-bar">
            {/* Type tabs */}
            <div className="type-pills-wrap">
              <button
                className={`type-pill ${typeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                All machines
              </button>
              <button
                className={`type-pill ${typeFilter === 'washer' ? 'active' : ''}`}
                onClick={() => setTypeFilter('washer')}
              >
                Washers
              </button>
              <button
                className={`type-pill ${typeFilter === 'dryer' ? 'active' : ''}`}
                onClick={() => setTypeFilter('dryer')}
              >
                Dryers
              </button>
            </div>

            {/* Search Input */}
            <div className="dash-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search machine or customer"
              />
            </div>

            {/* Status Filter dropdown */}
            <div className="status-filter-wrap">
              <Filter size={15} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="status-select"
              >
                <option value="all">All statuses</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          {/* Machine Floor Grid */}
          <div className="machine-cards-grid">
            {filteredMachines.map((m) => (
              <div key={m.code} className="machine-floor-card">
                <div className="floor-card-top">
                  <div className="code-badge-wrap">
                    <span className="machine-icon-tag">{m.type === 'washer' ? '🧺' : '🌀'}</span>
                    <span className="machine-code-text">{m.code}</span>
                  </div>

                  {m.status === 'occupied' && (
                    <span className="status-chip chip-blue">• Occupied</span>
                  )}
                  {m.status === 'available' && (
                    <span className="status-chip chip-green">• Available</span>
                  )}
                  {m.status === 'maintenance' && (
                    <span className="status-chip chip-orange">• Maintenance</span>
                  )}
                </div>

                <div className="floor-card-body">
                  {m.status === 'occupied' && (
                    <>
                      <h4 className="floor-primary-text">{m.timeRemaining} min left</h4>
                      <p className="floor-sub-text">{m.customer || 'Active session'}</p>
                    </>
                  )}
                  {m.status === 'available' && (
                    <>
                      <h4 className="floor-primary-text text-neutral">Ready for a load</h4>
                      <p className="floor-sub-text">No customer assigned</p>
                    </>
                  )}
                  {m.status === 'maintenance' && (
                    <>
                      <h4 className="floor-primary-text text-amber">Out of service</h4>
                      <p className="floor-sub-text">{m.note || 'Inspection required'}</p>
                    </>
                  )}
                </div>

                <div className="floor-card-actions">
                  <button
                    className="card-action-link"
                    onClick={() => {
                      setSelectedQrMachine(m.code);
                      const el = document.getElementById('qr-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Generate QR
                  </button>

                  <button
                    className="card-action-link"
                    onClick={() => handleToggleMaintenance(m.code)}
                  >
                    {m.status === 'maintenance' ? 'Mark available' : 'Mark maintenance'}
                  </button>

                  <button
                    className="card-action-delete"
                    onClick={() => handleRemoveMachine(m.code)}
                    title="Remove machine"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ================= CUSTOMER SESSIONS SECTION ================= */}
        <section id="sessions-section" className="dash-section">
          <div className="section-header-row">
            <div className="section-title-group">
              <h2 className="section-title">Customer sessions</h2>
              <span className="active-sessions-tag">• {occupiedCount} active</span>
            </div>

            <span className="masked-toggle-note">
              Contacts masked by default · Reveal per customer
            </span>
          </div>

          <div className="table-wrapper">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>CUSTOMER</th>
                  <th>CONTACT</th>
                  <th>MACHINE</th>
                  <th>SERVICE</th>
                  <th>SESSION STATUS</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cust-cell">
                        <div className="cust-avatar">{c.initials}</div>
                        <span className="cust-name">{c.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="contact-cell">
                        <span className="contact-email">
                          {c.revealed ? c.realEmail : c.email}
                        </span>
                        <span className="contact-phone">
                          {c.revealed ? c.realPhone : c.phone}
                        </span>
                        <button
                          className="reveal-btn"
                          onClick={() => toggleContactReveal(c.id)}
                        >
                          {c.revealed ? 'Hide' : 'Reveal'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className="machine-tag-cell">{c.machine}</span>
                    </td>
                    <td>
                      <span className="service-text">{c.service}</span>
                    </td>
                    <td>
                      <div className="session-status-cell">
                        <span className="in-progress-badge">In progress</span>
                        <span className="time-rem-text">{c.timeRemaining}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="view-details-link"
                        onClick={() => alert(`Customer Session for ${c.name}\nMachine: ${c.machine}\nEmail: ${c.realEmail}\nPhone: ${c.realPhone}`)}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-caption-note">Showing all {customers.length} active customer records</p>
        </section>

        {/* ================= QR LABELS SECTION ================= */}
        <section id="qr-section" className="dash-section qr-section-box">
          <div className="section-header-row">
            <div className="section-title-group">
              <h2 className="section-title">QR labels</h2>
              <span className="section-count-badge">{totalMachines} machines</span>
            </div>
            <span className="static-note">Live scannable QR generation for physical machines</span>
          </div>

          <div className="qr-selector-row">
            <label className="qr-select-label">Select machine to generate QR:</label>
            <div className="qr-select-box">
              <select
                value={selectedQrMachine}
                onChange={(e) => setSelectedQrMachine(e.target.value)}
                className="qr-dropdown"
              >
                {machines.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} - {m.type === 'washer' ? 'Washer' : 'Dryer'} ({m.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Printable Label Card matching Image 2 */}
          <div className="printable-qr-card" id="printable-qr-area">
            <div className="qr-card-header">
              <div className="qr-machine-info">
                <span className="qr-machine-icon">
                  {selectedMachineObj?.type === 'washer' ? '🧺' : '🌀'}
                </span>
                <div>
                  <h3 className="qr-machine-code">{selectedMachineObj?.code}</h3>
                  <p className="qr-machine-subtitle">
                    {selectedMachineObj?.note || `${selectedMachineObj?.type} machine`} · ready for print
                  </p>
                </div>
              </div>

              <span className={`status-chip ${selectedMachineObj?.status === 'available' ? 'chip-green' : selectedMachineObj?.status === 'occupied' ? 'chip-blue' : 'chip-orange'}`}>
                • {selectedMachineObj?.status}
              </span>
            </div>

            <div className="qr-card-body">
              {/* QR Image */}
              <div className="qr-image-wrapper">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={`QR for ${selectedQrMachine}`} className="actual-qr-image" />
                ) : (
                  <div className="qr-placeholder">Generating...</div>
                )}
              </div>

              {/* QR Info */}
              <div className="qr-text-info">
                <span className="qr-dest-label">Customer check-in destination:</span>
                <h4 className="qr-url-text" style={{ wordBreak: 'break-all' }}>
                  {`http://${(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? (detectedLanIp || window.location.hostname) : window.location.hostname}:${window.location.port || '5173'}/?machine=${selectedMachineObj?.code}`}
                </h4>
                <p className="qr-instruction-text">
                  Customers scan this physical QR label with their phone camera to instantly start a session on {selectedMachineObj?.code}.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="qr-card-footer">
              <button
                className="qr-action-btn primary-qr-btn"
                onClick={() => {
                  alert(`QR Code regenerated for ${selectedMachineObj?.code}! Ready for download and sticker printing.`);
                }}
              >
                <Plus size={16} />
                <span>Generate QR</span>
              </button>

              <a
                href={qrDataUrl}
                download={`spin-and-stay-${selectedMachineObj?.code}.png`}
                className="qr-action-btn secondary-qr-btn"
              >
                <Download size={16} />
                <span>Download label</span>
              </a>

              <button
                className="qr-action-btn outline-qr-btn"
                onClick={handlePrintLabel}
              >
                <Printer size={16} />
                <span>Print label</span>
              </button>

              <span className="qr-footer-hint">
                Labels print at 3.5" x 4" sticker size with wash instructions.
              </span>
            </div>
          </div>
        </section>

        {/* Global Dashboard Disclaimer */}
        <footer className="dash-footer">
          <p>
            Spin &amp; Stay Owner Portal · All rights reserved · Logged in as <strong>Vikranth</strong>
          </p>
        </footer>
      </main>

      {/* ================= ADD MACHINE MODAL ================= */}
      {isAddModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Machine</h3>
              <button className="modal-close-btn" onClick={() => setIsAddModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleAddMachine} className="modal-form">
              <div className="modal-field">
                <label>Machine Code</label>
                <input
                  type="text"
                  placeholder="e.g. W-05 or D-05"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="modal-field">
                <label>Machine Type</label>
                <div className="modal-type-grid">
                  <button
                    type="button"
                    className={`type-select-btn ${newType === 'washer' ? 'active' : ''}`}
                    onClick={() => setNewType('washer')}
                  >
                    🧺 Washing Machine
                  </button>
                  <button
                    type="button"
                    className={`type-select-btn ${newType === 'dryer' ? 'active' : ''}`}
                    onClick={() => setNewType('dryer')}
                  >
                    🌀 Dryer
                  </button>
                </div>
              </div>

              <div className="modal-field">
                <label>Initial Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="modal-select"
                >
                  <option value="available">Available (Ready for customers)</option>
                  <option value="maintenance">Maintenance (Out of service)</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 10kg High-efficiency Speed Queen"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
              </div>

              <div className="modal-btn-row">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn">
                  Add Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
