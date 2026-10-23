import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { ExternalLink } from 'lucide-react';
import '../OwnerPortal.css';

// Modular Child Components
import OwnerSidebar from './owner/OwnerSidebar';
import OverviewView from './owner/OverviewView';
import ReportsView from './owner/ReportsView';
import ActivityView from './owner/ActivityView';
import {
  AddMachineModal,
  ManualSessionModal,
  EditSessionModal,
  MachineDetailModal
} from './owner/OwnerModals';

// Initial default machines fallback
const INITIAL_MACHINES = [
  { id: 'W-01', code: 'W-01', type: 'washer', status: 'occupied', timeRemaining: 18, customer: 'Alex Morgan', service: 'Wash', note: 'Standard wash cycle' },
  { id: 'W-02', code: 'W-02', type: 'washer', status: 'occupied', timeRemaining: 7, customer: 'Priya Shah', service: 'Wash', note: 'Delicate cycle' },
  { id: 'W-03', code: 'W-03', type: 'washer', status: 'available', timeRemaining: 0, customer: null, service: 'Wash', note: 'Newly added washer · ready for print' },
  { id: 'W-04', code: 'W-04', type: 'washer', status: 'available', timeRemaining: 0, customer: null, service: 'Wash', note: 'Ready for a load' },
  { id: 'W-05', code: 'W-05', type: 'washer', status: 'maintenance', timeRemaining: 0, customer: null, service: 'Wash', note: 'Drum balance inspection' },
  { id: 'D-01', code: 'D-01', type: 'dryer', status: 'occupied', timeRemaining: 34, customer: 'David Kim', service: 'Dry', note: 'High heat cycle' },
  { id: 'D-02', code: 'D-02', type: 'dryer', status: 'occupied', timeRemaining: 12, customer: 'Elena Rostova', service: 'Dry', note: 'Medium heat cycle' },
  { id: 'D-03', code: 'D-03', type: 'dryer', status: 'available', timeRemaining: 0, customer: null, service: 'Dry', note: 'Ready for a load' },
  { id: 'D-04', code: 'D-04', type: 'dryer', status: 'available', timeRemaining: 0, customer: null, service: 'Dry', note: 'Ready for a load' }
];

export default function OwnerDashboard() {
  const navigate = useNavigate();

  // Navigation tab in sidebar ('overview', 'reports', 'activity')
  const [activeNav, setActiveNav] = useState('overview');

  // Machines state (fetched live from Django API)
  const [machines, setMachines] = useState([]);
  // Customers state (fetched live from Django API)
  const [customers, setCustomers] = useState([]);

  // Filters for Overview
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'washer', 'dryer'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'available', 'occupied', 'maintenance'
  const [searchQuery, setSearchQuery] = useState('');

  // QR Code Generation
  const [selectedQrMachine, setSelectedQrMachine] = useState('W-1');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState('washer');
  const [newStatus, setNewStatus] = useState('available');
  const [newNote, setNewNote] = useState('');

  const [selectedDetailMachine, setSelectedDetailMachine] = useState(null);

  // Real-time ticker: updates every second so remaining countdown ticks live
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dynamic API host
  const apiHost = window.location.hostname || '127.0.0.1';
  const [detectedLanIp, setDetectedLanIp] = useState('');

  // ================= REPORTS & ANALYTICS STATE =================
  const [selectedReportDate, setSelectedReportDate] = useState('all');
  const [reportAnalytics, setReportAnalytics] = useState({
    selected_date: 'all',
    available_dates: [],
    summary: {
      total_sessions: 0,
      unique_customers: 0,
      completed_count: 0,
      cancelled_count: 0,
      active_count: 0,
      total_minutes: 0,
      most_active_machine: 'N/A'
    },
    machine_breakdown: []
  });
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('all');

  // Manual Walk-In Session Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualMachine, setManualMachine] = useState('W-1');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualDuration, setManualDuration] = useState(30);
  const [manualStatus, setManualStatus] = useState('completed');

  // Edit Session Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [editStatus, setEditStatus] = useState('completed');

  // ================= ACTIVITY STATE =================
  const [notificationsList, setNotificationsList] = useState([]);
  const [activitySearch, setActivitySearch] = useState('');

  // Fetch Notifications History
  const fetchNotifications = async () => {
    try {
      let res = await fetch(`/api/notifications/`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/notifications/`);
      }
      if (res.ok) {
        const data = await res.json();
        setNotificationsList(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.warn('Notifications fetch error:', e);
    }
  };

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

  // Fetch Day-wise Report Analytics
  const fetchReportAnalytics = async (date = selectedReportDate) => {
    try {
      let res = await fetch(`/api/reports/analytics/?date=${date}`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/reports/analytics/?date=${date}`);
      }
      if (res.ok) {
        const data = await res.json();
        setReportAnalytics(data);
      }
    } catch (e) {
      console.warn('Analytics fetch error:', e);
    }
  };

  useEffect(() => {
    fetchReportAnalytics(selectedReportDate);
    if (activeNav === 'activity') {
      fetchNotifications();
    }
  }, [selectedReportDate, activeNav]);

  // Export CSV Handler
  const handleExportCSV = () => {
    const url = `http://${apiHost}:8000/api/reports/csv/?date=${selectedReportDate}&status=${reportStatusFilter}&search=${encodeURIComponent(reportSearch)}`;
    window.open(url, '_blank');
  };

  // Export PDF Handler
  const handleExportPDF = () => {
    const url = `http://${apiHost}:8000/api/reports/pdf/?date=${selectedReportDate}&status=${reportStatusFilter}&search=${encodeURIComponent(reportSearch)}`;
    window.open(url, '_blank');
  };

  // Create Manual Walk-in Session
  const handleCreateManualSession = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://${apiHost}:8000/api/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_code: manualMachine,
          customer_name: manualName.trim() || 'Walk-in Customer',
          customer_email: manualEmail.trim() || `walkin-${Date.now()}@laundromat.local`,
          customer_phone: manualPhone.trim(),
          duration_minutes: parseInt(manualDuration, 10) || 30,
          status: manualStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create session');

      setIsManualModalOpen(false);
      setManualName('');
      setManualEmail('');
      setManualPhone('');
      setManualDuration(30);
      setManualStatus('completed');

      await fetchBackendSessions();
      await fetchBackendMachines();
      await fetchReportAnalytics(selectedReportDate);
      alert(`✅ Walk-in session successfully recorded for ${data.customer_name}!`);
    } catch (err) {
      alert(`Error creating session: ${err.message}`);
    }
  };

  // Open Edit Session Modal
  const openEditModal = (session) => {
    setEditingSession(session);
    setEditName(session.name || '');
    setEditEmail(session.realEmail || '');
    setEditPhone(session.realPhone !== 'Not provided' ? session.realPhone : '');
    setEditDuration(session.duration || 30);
    setEditStatus(session.status || 'completed');
    setIsEditModalOpen(true);
  };

  // Update Existing Session
  const handleUpdateSession = async (e) => {
    e.preventDefault();
    if (!editingSession) return;
    try {
      const res = await fetch(`http://${apiHost}:8000/api/sessions/${editingSession.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: editName.trim(),
          customer_email: editEmail.trim(),
          customer_phone: editPhone.trim(),
          duration_minutes: parseInt(editDuration, 10) || 30,
          status: editStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update session');

      setIsEditModalOpen(false);
      setEditingSession(null);

      await fetchBackendSessions();
      await fetchBackendMachines();
      await fetchReportAnalytics(selectedReportDate);
      alert(`✅ Session #${editingSession.id} successfully updated!`);
    } catch (err) {
      alert(`Error updating session: ${err.message}`);
    }
  };

  // Delete Session
  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm(`Are you sure you want to permanently delete session #${sessionId}?`)) return;
    try {
      const res = await fetch(`http://${apiHost}:8000/api/sessions/${sessionId}/`, {
        method: 'DELETE'
      });
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete session');

      await fetchBackendSessions();
      await fetchBackendMachines();
      await fetchReportAnalytics(selectedReportDate);
      alert(`🗑️ Session #${sessionId} permanently removed.`);
    } catch (err) {
      alert(`Error deleting session: ${err.message}`);
    }
  };

  // 1. Fetch Machines live from Django REST Framework
  const fetchBackendMachines = async () => {
    try {
      let res = await fetch(`/api/machines/`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/machines/`);
      }
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((m) => {
          let uiStatus = 'available';
          if (m.status === 'maintenance') {
            uiStatus = 'maintenance';
          } else if (m.status === 'in_use' || !m.is_available) {
            uiStatus = 'occupied';
          }

          return {
            id: m.machine_code,
            code: m.machine_code,
            type: m.machine_type,
            status: uiStatus,
            timeRemaining: m.minutes_remaining || 0,
            secondsRemaining: m.seconds_remaining || 0,
            totalSeconds: m.total_seconds || 0,
            expectedEndAt: m.expected_end_at || null,
            customer: null,
            service: m.machine_type === 'dryer' ? 'Dry' : 'Wash',
            note: m.machine_type === 'dryer' ? 'Medium heat cycle' : 'Standard wash cycle'
          };
        });
        setMachines(mapped);
      } else {
        setMachines((prev) => (prev.length > 0 ? prev : INITIAL_MACHINES));
      }
    } catch (err) {
      console.warn('Could not load machines from Django:', err);
      setMachines((prev) => (prev.length > 0 ? prev : INITIAL_MACHINES));
    }
  };

  // 2. Fetch Sessions live from Django REST Framework
  const fetchBackendSessions = async () => {
    try {
      let res = await fetch(`/api/sessions/`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/sessions/`);
      }
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((s) => {
          const emailParts = s.customer_email ? s.customer_email.split('@') : ['user', 'gmail.com'];
          const maskedEmail = emailParts[0].length > 1
            ? `${emailParts[0][0]}•••@${emailParts[1] || 'gmail.com'}`
            : s.customer_email;

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
            duration: s.duration_minutes,
            startedAt: s.started_at ? new Date(s.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            completedAt: s.completed_at ? new Date(s.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            rawStartedAt: s.started_at,
            rawDate: s.started_at ? s.started_at.split('T')[0] : '',
            timeRemaining: s.status === 'active' ? 'Active in progress' : s.status,
            status: s.status,
            emailSent: !!s.email_sent,
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
    fetchNotifications();
    const interval = setInterval(() => {
      fetchBackendMachines();
      fetchBackendSessions();
      if (activeNav === 'activity') {
        fetchNotifications();
      }
    }, 4000); // 4-second real-time poll
    return () => clearInterval(interval);
  }, [apiHost, activeNav]);

  // Generate QR Code for selected machine
  useEffect(() => {
    const target = machines.find((m) => m.code === selectedQrMachine) || machines[0];
    if (target) {
      const hostIp = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? (detectedLanIp || window.location.hostname)
        : window.location.hostname;
      const port = window.location.port || '5173';
      const checkinUrl = `http://${hostIp}:${port}/?machine=${target.code}`;

      QRCode.toDataURL(checkinUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0B1A44',
          light: '#FFFFFF'
        }
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code error:', err));
    }
  }, [selectedQrMachine, machines, detectedLanIp]);

  // Print Label Handler
  const handlePrintLabel = () => {
    const target = machines.find((m) => m.code === selectedQrMachine) || machines[0];
    const hostIp = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? (detectedLanIp || window.location.hostname)
      : window.location.hostname;
    const port = window.location.port || '5173';
    const checkinUrl = `http://${hostIp}:${port}/?machine=${target?.code || 'W-1'}`;

    const printWin = window.open('', '_blank', 'width=520,height=680');
    if (!printWin) {
      alert('Please allow popups to print machine QR stickers.');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Label - ${target?.code}</title>
          <style>
            @page { size: 3.5in 4.5in; margin: 0.15in; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 18px; color: #0b1a44; text-align: center; }
            .brand-head { font-size: 13px; font-weight: 800; letter-spacing: 1.5px; color: #2558ea; text-transform: uppercase; margin-bottom: 4px; }
            .store-name { font-size: 22px; font-weight: 800; margin: 0 0 10px 0; }
            .code-pill { display: inline-block; background: #0b1a44; color: #ffffff; font-size: 24px; font-weight: 900; padding: 6px 20px; border-radius: 999px; margin-bottom: 12px; letter-spacing: 0.5px; }
            .qr-wrap img { width: 220px; height: 220px; margin: 0 auto; display: block; border: 2px solid #e2e8f0; border-radius: 12px; padding: 6px; }
            .instructions { font-size: 14px; font-weight: 700; margin: 12px 0 4px 0; color: #0b1a44; }
            .sub-inst { font-size: 11.5px; color: #64748b; margin: 0; line-height: 1.4; }
            .dest-url { font-family: monospace; font-size: 10px; color: #2558ea; margin-top: 8px; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="brand-head">Spin &amp; Stay</div>
          <h1 class="store-name">Main Street Laundromat</h1>
          <div class="code-pill">${target?.type === 'washer' ? '🧺 Washer' : '🌀 Dryer'} ${target?.code}</div>
          <div class="qr-wrap"><img src="${qrDataUrl}" alt="${target?.code}" /></div>
          <p class="instructions">Scan camera to start load &amp; track timer</p>
          <p class="sub-inst">No application install required · Instant mobile check-in</p>
          <div class="dest-url">${checkinUrl}</div>
          <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Add Machine Handler
  const handleAddMachine = async (e) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    const cleanCode = newCode.trim().toUpperCase();

    try {
      const res = await fetch(`http://${apiHost}:8000/api/machines/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_code: cleanCode,
          machine_type: newType,
          status: newStatus
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add machine');
      }

      await fetchBackendMachines();
      setSelectedQrMachine(cleanCode);
      setIsAddModalOpen(false);
      setNewCode('');
      setNewNote('');
      setNewStatus('available');
    } catch (err) {
      alert(`Could not add machine: ${err.message}`);
    }
  };

  // Remove Machine Handler
  const handleRemoveMachine = async (code) => {
    if (!window.confirm(`Are you sure you want to remove machine ${code}?`)) return;

    try {
      const res = await fetch(`http://${apiHost}:8000/api/machines/${code}/`, {
        method: 'DELETE'
      });

      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to delete machine');
      }

      await fetchBackendMachines();
      if (selectedQrMachine === code) {
        setSelectedQrMachine(machines[0]?.code || 'W-1');
      }
    } catch (err) {
      alert(`Error removing machine: ${err.message}`);
    }
  };

  // Toggle Maintenance Status Handler
  const handleToggleMaintenance = async (code) => {
    const current = machines.find((m) => m.code === code);
    if (!current) return;
    const nextStatus = current.status === 'maintenance' ? 'available' : 'maintenance';

    try {
      const res = await fetch(`http://${apiHost}:8000/api/machines/${code}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!res.ok) {
        throw new Error('Failed to toggle status');
      }

      await fetchBackendMachines();
    } catch (err) {
      alert(`Error updating machine: ${err.message}`);
    }
  };

  // Toggle Contact Reveal
  const toggleContactReveal = (id) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, revealed: !c.revealed } : c))
    );
  };

  // Sign out Handler
  const handleSignOut = () => {
    localStorage.removeItem('spin_owner_auth');
    navigate('/owner/login');
  };

  // Metrics calculation
  const totalMachines = machines.length;
  const availableCount = machines.filter((m) => m.status === 'available').length;
  const occupiedCount = machines.filter((m) => m.status === 'occupied').length;

  const washers = machines.filter((m) => m.type === 'washer');
  const dryers = machines.filter((m) => m.type === 'dryer');

  const occupiedWashers = washers.filter((m) => m.status === 'occupied').length;
  const availableWashers = washers.filter((m) => m.status === 'available').length;

  const occupiedDryers = dryers.filter((m) => m.status === 'occupied').length;
  const availableDryers = dryers.filter((m) => m.status === 'available').length;

  // Filtered machines for Overview display
  const filteredMachines = machines.filter((m) => {
    const matchesType = typeFilter === 'all' || m.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesSearch =
      m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.customer && m.customer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.note && m.note.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesStatus && matchesSearch;
  });

  // Filtered customer sessions for Reports view
  const filteredReportSessions = customers.filter((c) => {
    const matchesDate = selectedReportDate === 'all' || !selectedReportDate || c.rawDate === selectedReportDate;
    const matchesStatus = reportStatusFilter === 'all' || c.status === reportStatusFilter;
    const q = reportSearch.toLowerCase().trim();
    const matchesSearch = !q ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.realEmail && c.realEmail.toLowerCase().includes(q)) ||
      (c.realPhone && c.realPhone.toLowerCase().includes(q)) ||
      (c.machine && c.machine.toLowerCase().includes(q));
    return matchesDate && matchesStatus && matchesSearch;
  });

  // Live Countdown & Telemetry calculation for Machine Floor Cards
  const getMachineTimer = (machine) => {
    const activeSession = customers.find((c) => c.machine === machine.code && c.status === 'active');

    if (machine.status !== 'occupied') {
      return {
        isActive: false,
        formatted: machine.status === 'maintenance' ? 'OFFLINE' : '00:00',
        mins: 0,
        secs: 0,
        label: machine.status === 'maintenance' ? 'Under Maintenance' : 'Ready for Load',
        percent: 0,
        startedText: '-',
        endsText: '-',
        customerName: machine.status === 'maintenance' ? 'Flagged for inspection' : 'No active load',
        service: machine.type === 'washer' ? 'Wash' : 'Dry'
      };
    }

    const expectedEnd = machine.expectedEndAt || (activeSession?.rawStartedAt ? new Date(new Date(activeSession.rawStartedAt).getTime() + (activeSession.duration || 30) * 60000).toISOString() : null);

    if (!expectedEnd) {
      const mins = machine.timeRemaining || 0;
      return {
        isActive: true,
        formatted: `${mins < 10 ? '0' : ''}${mins}:00`,
        mins,
        secs: 0,
        label: `${mins} min left`,
        percent: 50,
        startedText: activeSession?.startedAt || 'Active',
        endsText: 'Soon',
        customerName: activeSession?.name || 'Customer Load',
        service: activeSession?.service || (machine.type === 'washer' ? 'Wash' : 'Dry')
      };
    }

    const endMs = new Date(expectedEnd).getTime();
    const diffMs = Math.max(0, endMs - currentTime);
    const totalSecs = Math.floor(diffMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;

    const totalDurationMins = activeSession?.duration || 30;
    const durationMs = totalDurationMins * 60 * 1000;
    const elapsedMs = Math.max(0, durationMs - diffMs);
    const percent = Math.min(100, Math.max(0, Math.round((elapsedMs / durationMs) * 100)));

    const endsDate = new Date(expectedEnd);
    const endsText = endsDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const startedDate = activeSession?.rawStartedAt ? new Date(activeSession.rawStartedAt) : null;
    const startedText = startedDate ? startedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '-';

    return {
      isActive: true,
      formatted: `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`,
      mins,
      secs,
      label: `${mins}m ${secs}s left`,
      percent,
      startedText,
      endsText,
      customerName: activeSession?.name || 'Active Load',
      service: activeSession?.service || (machine.type === 'washer' ? 'Wash' : 'Dry')
    };
  };

  const selectedMachineObj = machines.find((m) => m.code === selectedQrMachine) || machines[0];

  return (
    <div className="owner-dash-layout">
      {/* 1. SIDEBAR */}
      <OwnerSidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        totalMachines={totalMachines}
        activeCustomersCount={customers.length}
        onSignOut={handleSignOut}
      />

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main className="dashboard-main">
        {/* Top Header Bar */}
        <header className="main-topbar">
          <div className="breadcrumbs">
            <span>Owner portal</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">
              {activeNav === 'reports' ? 'Reports & Analytics' : activeNav === 'activity' ? 'Activity & Notifications' : 'Overview'}
            </span>
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

        {/* Dynamic Views */}
        {activeNav === 'reports' ? (
          <ReportsView
            selectedReportDate={selectedReportDate}
            setSelectedReportDate={setSelectedReportDate}
            reportAnalytics={reportAnalytics}
            handleExportCSV={handleExportCSV}
            handleExportPDF={handleExportPDF}
            setIsManualModalOpen={setIsManualModalOpen}
            reportSearch={reportSearch}
            setReportSearch={setReportSearch}
            reportStatusFilter={reportStatusFilter}
            setReportStatusFilter={setReportStatusFilter}
            filteredReportSessions={filteredReportSessions}
            fetchBackendSessions={fetchBackendSessions}
            fetchReportAnalytics={fetchReportAnalytics}
            toggleContactReveal={toggleContactReveal}
            openEditModal={openEditModal}
            handleDeleteSession={handleDeleteSession}
          />
        ) : activeNav === 'activity' ? (
          <ActivityView
            notificationsList={notificationsList}
            activeSessionsCount={occupiedCount}
            activitySearch={activitySearch}
            setActivitySearch={setActivitySearch}
            fetchNotifications={fetchNotifications}
          />
        ) : (
          <OverviewView
            totalMachines={totalMachines}
            availableCount={availableCount}
            availableWashers={availableWashers}
            availableDryers={availableDryers}
            occupiedWashers={occupiedWashers}
            washers={washers}
            occupiedDryers={occupiedDryers}
            dryers={dryers}
            occupiedCount={occupiedCount}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredMachines={filteredMachines}
            setIsAddModalOpen={setIsAddModalOpen}
            setSelectedDetailMachine={setSelectedDetailMachine}
            handleToggleMaintenance={handleToggleMaintenance}
            handleRemoveMachine={handleRemoveMachine}
            getMachineTimer={getMachineTimer}
            customers={customers}
            toggleContactReveal={toggleContactReveal}
            selectedQrMachine={selectedQrMachine}
            setSelectedQrMachine={setSelectedQrMachine}
            selectedMachineObj={selectedMachineObj}
            qrDataUrl={qrDataUrl}
            detectedLanIp={detectedLanIp}
            handlePrintLabel={handlePrintLabel}
          />
        )}

        {/* Global Dashboard Disclaimer */}
        <footer className="dash-footer">
          <p>
            Spin &amp; Stay Owner Portal · All rights reserved · Logged in as <strong>Vikranth</strong>
          </p>
        </footer>
      </main>

      {/* 3. MODALS */}
      <AddMachineModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddMachine}
        newCode={newCode}
        setNewCode={setNewCode}
        newType={newType}
        setNewType={setNewType}
        newStatus={newStatus}
        setNewStatus={setNewStatus}
        newNote={newNote}
        setNewNote={setNewNote}
      />

      <ManualSessionModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleCreateManualSession}
        machines={machines}
        manualMachine={manualMachine}
        setManualMachine={setManualMachine}
        manualName={manualName}
        setManualName={setManualName}
        manualPhone={manualPhone}
        setManualPhone={setManualPhone}
        manualEmail={manualEmail}
        setManualEmail={setManualEmail}
        manualDuration={manualDuration}
        setManualDuration={setManualDuration}
        manualStatus={manualStatus}
        setManualStatus={setManualStatus}
      />

      <EditSessionModal
        isOpen={isEditModalOpen}
        session={editingSession}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdateSession}
        editName={editName}
        setEditName={setEditName}
        editPhone={editPhone}
        setEditPhone={setEditPhone}
        editEmail={editEmail}
        setEditEmail={setEditEmail}
        editDuration={editDuration}
        setEditDuration={setEditDuration}
        editStatus={editStatus}
        setEditStatus={setEditStatus}
      />

      <MachineDetailModal
        machine={selectedDetailMachine}
        onClose={() => setSelectedDetailMachine(null)}
        getMachineTimer={getMachineTimer}
      />
    </div>
  );
}
