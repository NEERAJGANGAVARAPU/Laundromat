
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
  ExternalLink,
  BarChart3,
  FileSpreadsheet,
  FileText,
  Calendar,
  Edit3,
  UserPlus,
  X,
  RefreshCw,
  Lock,
  KeyRound,
  ShieldCheck,
  Mail,
  ArrowRight,
  Menu,
  X as XIcon
} from 'lucide-react';
import ActivityAnalyticsView from './owner/ActivityAnalyticsView';
import {
  Skeleton,
  SkeletonKPIGrid,
  SkeletonMachineGrid,
  SkeletonTableRows,
  SkeletonReportKPIGrid
} from './common/Skeleton';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Skeleton loading states
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isReportLoading, setIsReportLoading] = useState(false);

  // Online / Low Bandwidth / Offline Connectivity State
  // Values: 'online' (green), 'slow' (orange), 'offline' (red)
  const [networkStatus, setNetworkStatus] = useState(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    return 'online';
  });
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState(null);

  // Helper to determine network quality based on measured round-trip time and Network Information API
  const updateNetworkQuality = (latencyMs) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setNetworkStatus('offline');
      return;
    }

    if (latencyMs !== undefined && latencyMs !== null) {
      setLastLatencyMs(latencyMs);
    }

    // Check navigator.connection if supported (Chrome, Edge, Android)
    const conn = typeof navigator !== 'undefined' && (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    const isConnSlow = conn && (
      conn.effectiveType === 'slow-2g' ||
      conn.effectiveType === '2g' ||
      (conn.downlink && conn.downlink < 1.0) ||
      (conn.rtt && conn.rtt >= 600)
    );

    // Latency >= 1200ms or browser reported slow connection
    if (isConnSlow || (latencyMs && latencyMs >= 1200)) {
      setNetworkStatus('slow');
    } else {
      setNetworkStatus('online');
    }
  };

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

  // Access Settings State (Password Change & Reset)
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState(null);
  const [storedPasswordTime, setStoredPasswordTime] = useState(
    localStorage.getItem('spin_owner_password_updated_at')
  );
  const [authStatus, setAuthStatus] = useState({
    username: 'admin',
    is_default_password: true,
    last_login: null
  });

  // Google Recovery Email & OTP Auth States
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isRecoveryEmailVerified, setIsRecoveryEmailVerified] = useState(true);
  const [isGoogleVerifyModalOpen, setIsGoogleVerifyModalOpen] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleVerifyLoading, setGoogleVerifyLoading] = useState(false);
  const [googleVerifyError, setGoogleVerifyError] = useState('');
  const [googleVerifySuccess, setGoogleVerifySuccess] = useState('');

  // Post-OTP Login "Wanna change your password?" Prompt State
  const [showChangePasswordPrompt, setShowChangePasswordPrompt] = useState(false);
  const [isOtpResetFlow, setIsOtpResetFlow] = useState(false);

  const fetchAuthStatus = async () => {
    try {
      let res = await fetch('/api/auth/status/').catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/auth/status/`);
      }
      if (res && res.ok) {
        const data = await res.json();
        setAuthStatus(data);
      }
    } catch (e) {
      console.warn('Could not fetch auth status:', e);
    }
  };

  const fetchRecoveryEmail = async () => {
    try {
      let res = await fetch('/api/auth/recovery-email/').catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/auth/recovery-email/`);
      }
      if (res && res.ok) {
        const data = await res.json();
        const email = data.email || '';
        const verified = Boolean(data.verified);
        setRecoveryEmail(email);
        setIsRecoveryEmailVerified(verified);
        if (email) {
          setGoogleEmailInput(email);
        }
        // One-time prompt: only open if recovery email has not yet been set/verified
        if (!verified || !email) {
          setIsGoogleVerifyModalOpen(true);
        }
      }
    } catch (e) {
      console.warn('Could not fetch recovery email status:', e);
    }
  };

  const handleSaveGoogleEmail = async (e) => {
    if (e) e.preventDefault();
    setGoogleVerifyError('');
    setGoogleVerifySuccess('');
    const emailToSave = googleEmailInput.trim().toLowerCase();
    if (!emailToSave || !emailToSave.includes('@')) {
      setGoogleVerifyError('Please enter a valid Google email address.');
      return;
    }
    setGoogleVerifyLoading(true);
    try {
      let res = await fetch('/api/auth/recovery-email/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToSave })
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/auth/recovery-email/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailToSave })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save Google recovery email.');
      }

      setRecoveryEmail(data.email || emailToSave);
      setIsRecoveryEmailVerified(true);
      setGoogleVerifyLoading(false);
      setIsGoogleVerifyModalOpen(false);
      setGoogleVerifySuccess('Google recovery email verified and stored securely.');
    } catch (err) {
      setGoogleVerifyLoading(false);
      setGoogleVerifyError(err.message || 'Error saving Google email.');
    }
  };

  const clearOtpLoginFlag = () => {
    try {
      const auth = JSON.parse(localStorage.getItem('spin_owner_auth') || '{}');
      auth.logged_in_via_otp = false;
      localStorage.setItem('spin_owner_auth', JSON.stringify(auth));
      sessionStorage.removeItem('spin_owner_logged_in_via_otp');
    } catch (e) {
      console.warn('Could not clear OTP flag:', e);
    }
  };

  const handleOtpPromptLetsGo = () => {
    clearOtpLoginFlag();
    setShowChangePasswordPrompt(false);
    setIsOtpResetFlow(true);
    setActiveNav('security');
  };

  const handleOtpPromptNotNow = () => {
    clearOtpLoginFlag();
    setShowChangePasswordPrompt(false);
    setIsOtpResetFlow(false);
  };

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
  const [reportDatePreset, setReportDatePreset] = useState('all'); // 'all', 'today', 'week', 'month', 'custom'
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
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

  // Manual Walk-In Session Modal State (Create)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualMachine, setManualMachine] = useState('W-1');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualDuration, setManualDuration] = useState(30);
  const [manualStatus, setManualStatus] = useState('completed');

  // Edit Session Modal State (Update)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [editStatus, setEditStatus] = useState('completed');

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

  // Helper to format Date into YYYY-MM-DD
  const toISODate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch Report Analytics for date range
  const fetchReportAnalytics = async (sDate = reportStartDate, eDate = reportEndDate) => {
    setIsReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (sDate) params.append('start_date', sDate);
      if (eDate) params.append('end_date', eDate);
      if (!sDate && !eDate) params.append('date', 'all');

      let res = await fetch(`/api/reports/analytics/?${params.toString()}`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/reports/analytics/?${params.toString()}`);
      }
      if (res && res.ok) {
        const data = await res.json();
        setReportAnalytics(data);
      }
    } catch (e) {
      console.warn('Analytics fetch error:', e);
    } finally {
      setIsReportLoading(false);
    }
  };

  // Handle Date Range Presets
  const handleDatePreset = (preset) => {
    setReportDatePreset(preset);
    const today = new Date();
    if (preset === 'all') {
      setReportStartDate('');
      setReportEndDate('');
      fetchReportAnalytics('', '');
    } else if (preset === 'today') {
      const todayStr = toISODate(today);
      setReportStartDate(todayStr);
      setReportEndDate(todayStr);
      fetchReportAnalytics(todayStr, todayStr);
    } else if (preset === 'week') {
      const past7 = new Date();
      past7.setDate(today.getDate() - 6);
      const startStr = toISODate(past7);
      const endStr = toISODate(today);
      setReportStartDate(startStr);
      setReportEndDate(endStr);
      fetchReportAnalytics(startStr, endStr);
    } else if (preset === 'month') {
      const past30 = new Date();
      past30.setDate(today.getDate() - 29);
      const startStr = toISODate(past30);
      const endStr = toISODate(today);
      setReportStartDate(startStr);
      setReportEndDate(endStr);
      fetchReportAnalytics(startStr, endStr);
    } else if (preset === 'custom') {
      const todayStr = toISODate(today);
      const s = reportStartDate || todayStr;
      const e = reportEndDate || todayStr;
      setReportStartDate(s);
      setReportEndDate(e);
      fetchReportAnalytics(s, e);
    }
  };

  const handleStartDateChange = (val) => {
    setReportStartDate(val);
    setReportDatePreset('custom');
    fetchReportAnalytics(val, reportEndDate);
  };

  const handleEndDateChange = (val) => {
    setReportEndDate(val);
    setReportDatePreset('custom');
    fetchReportAnalytics(reportStartDate, val);
  };

  useEffect(() => {
    if (activeNav === 'reports') {
      fetchReportAnalytics();
    }
  }, [activeNav]);

  // Export XLS Handler
  const handleExportXLS = () => {
    const params = new URLSearchParams();
    if (reportStartDate) params.append('start_date', reportStartDate);
    if (reportEndDate) params.append('end_date', reportEndDate);
    if (!reportStartDate && !reportEndDate) params.append('date', 'all');
    if (reportStatusFilter !== 'all') params.append('status', reportStatusFilter);
    if (reportSearch) params.append('search', reportSearch);

    const url = `http://${apiHost}:8000/api/reports/xls/?${params.toString()}`;
    window.open(url, '_blank');
  };

  // Export PDF Handler
  const handleExportPDF = () => {
    const params = new URLSearchParams();
    if (reportStartDate) params.append('start_date', reportStartDate);
    if (reportEndDate) params.append('end_date', reportEndDate);
    if (!reportStartDate && !reportEndDate) params.append('date', 'all');
    if (reportStatusFilter !== 'all') params.append('status', reportStatusFilter);
    if (reportSearch) params.append('search', reportSearch);

    const url = `http://${apiHost}:8000/api/reports/pdf/?${params.toString()}`;
    window.open(url, '_blank');
  };

  // Create Manual Walk-in Session
  const handleCreateManualSession = async (e) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanPhone = manualPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      alert(`Phone number must be exactly 10 digits (currently ${cleanPhone.length}/10 digits).`);
      return;
    }
    if (manualEmail.trim() && !emailRegex.test(manualEmail.trim())) {
      alert('Please provide a valid email address (must include "@" and a domain, e.g. name@example.com).');
      return;
    }

    try {
      const res = await fetch(`http://${apiHost}:8000/api/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_code: manualMachine,
          customer_name: manualName.trim() || 'Walk-in Customer',
          customer_email: manualEmail.trim() || `walkin-${Date.now()}@laundromat.local`,
          customer_phone: cleanPhone,
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
      fetchBackendSessions();
      fetchBackendMachines();
      fetchReportAnalytics();
      alert('Walk-in session recorded successfully!');
    } catch (err) {
      alert(`Error creating session: ${err.message}`);
    }
  };

  // Open Edit Session Modal
  const openEditModal = (sess) => {
    setEditingSession(sess);
    setEditName(sess.name || '');
    setEditEmail(sess.realEmail || '');
    setEditPhone(sess.realPhone && sess.realPhone !== 'Not provided' ? sess.realPhone : '');
    setEditDuration(sess.duration || 30);
    setEditStatus(sess.status || 'completed');
    setIsEditModalOpen(true);
  };

  // Update Session Handler (PATCH)
  const handleUpdateSession = async (e) => {
    e.preventDefault();
    if (!editingSession) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanPhone = editPhone.replace(/\D/g, '');
    if (cleanPhone && cleanPhone.length !== 10) {
      alert(`Phone number must be exactly 10 digits (currently ${cleanPhone.length}/10 digits).`);
      return;
    }
    if (editEmail.trim() && !emailRegex.test(editEmail.trim())) {
      alert('Please provide a valid email address (must include "@" and a domain, e.g. name@example.com).');
      return;
    }

    try {
      const res = await fetch(`http://${apiHost}:8000/api/sessions/${editingSession.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: editName.trim(),
          customer_email: editEmail.trim(),
          customer_phone: cleanPhone || editPhone.trim(),
          duration_minutes: parseInt(editDuration, 10) || 30,
          status: editStatus
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update session');
      }

      setIsEditModalOpen(false);
      setEditingSession(null);
      fetchBackendSessions();
      fetchBackendMachines();
      fetchReportAnalytics();
      alert('Session updated successfully!');
    } catch (err) {
      alert(`Update error: ${err.message}`);
    }
  };

  // Delete Session Handler (DELETE)
  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to permanently delete this customer session?')) return;
    try {
      const res = await fetch(`http://${apiHost}:8000/api/sessions/${sessionId}/`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete session');

      fetchBackendSessions();
      fetchBackendMachines();
      fetchReportAnalytics();
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // Fetch live machines from Django backend
  const fetchBackendMachines = async () => {
    const t0 = performance.now();
    try {
      let res = await fetch('/api/machines/').catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/machines/`);
      }
      const latency = Math.round(performance.now() - t0);
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped = data.map((m) => ({
          id: m.machine_code,
          code: m.machine_code,
          type: m.machine_type,
          status: m.status === 'in_use' ? 'occupied' : m.status,
          timeRemaining: m.minutes_remaining || 0,
          secondsRemaining: m.seconds_remaining || 0,
          totalSeconds: m.total_seconds || 0,
          expectedEndAt: m.expected_end_at || null,
          activeSessionId: m.active_session_id || null,
          customer: m.status === 'in_use' ? 'Wash in progress' : null,
          service: m.machine_type === 'washer' ? 'Wash' : 'Dry',
          note: m.status === 'maintenance' ? 'Under inspection / maintenance' : `${m.machine_type === 'washer' ? 'Washer' : 'Dryer'} ready for use`
        }));
        setMachines(mapped);
        if (mapped.length > 0 && !selectedQrMachine) {
          setSelectedQrMachine(mapped[0].code);
        }
        updateNetworkQuality(latency);
      }
    } catch (err) {
      console.warn('Could not load machines from Django:', err);
      setNetworkStatus('offline');
    }
  };

  // Fetch live sessions from Django backend
  const fetchBackendSessions = async () => {
    const t0 = performance.now();
    try {
      let res = await fetch('/api/sessions/').catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/sessions/`);
      }
      const latency = Math.round(performance.now() - t0);
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
            duration: s.duration_minutes,
            startedAt: s.started_at ? new Date(s.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            completedAt: s.completed_at ? new Date(s.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            rawStartedAt: s.started_at,
            rawDate: s.started_at ? s.started_at.split('T')[0] : '',
            timeRemaining: s.status === 'active' ? 'Active in progress' : s.status,
            status: s.status,
            emailSent: !!s.email_sent,
            reminderEmailSent: !!s.reminder_email_sent,
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
        updateNetworkQuality(latency);
      }
    } catch (err) {
      console.warn('Could not load sessions from Django:', err);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setNetworkStatus('offline');
      }
    }
  };

  // Browser Online / Offline & Network Information Listeners
  useEffect(() => {
    const handleOnline = () => {
      fetchBackendMachines();
      fetchBackendSessions();
    };
    const handleOffline = () => {
      setNetworkStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = typeof navigator !== 'undefined' && (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    const handleConnChange = () => {
      updateNetworkQuality(lastLatencyMs);
    };
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', handleConnChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', handleConnChange);
      }
    };
  }, [apiHost, lastLatencyMs]);

  // Manual Check / Reconnect trigger on "Live portal" / "Low internet" / "Offline" toggle
  const handleToggleOrCheckConnection = async () => {
    setIsCheckingConnection(true);
    const t0 = performance.now();
    try {
      let res = await fetch('/api/machines/').catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/machines/`);
      }
      const latency = Math.round(performance.now() - t0);
      if (res && res.ok) {
        updateNetworkQuality(latency);
        await Promise.all([
          fetchBackendMachines(),
          fetchBackendSessions()
        ]);
      } else {
        setNetworkStatus('offline');
      }
    } catch (e) {
      setNetworkStatus('offline');
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Poll live data on mount
  useEffect(() => {
    Promise.all([
      fetchBackendMachines(),
      fetchBackendSessions(),
      fetchAuthStatus(),
      fetchRecoveryEmail()
    ]).finally(() => {
      setIsInitialLoading(false);
    });

    // Check if owner logged in via OTP
    try {
      const auth = JSON.parse(localStorage.getItem('spin_owner_auth') || '{}');
      const isOtp = auth.logged_in_via_otp === true || sessionStorage.getItem('spin_owner_logged_in_via_otp') === 'true';
      if (isOtp) {
        setShowChangePasswordPrompt(true);
      }
    } catch (e) {
      console.warn('Could not read auth flag:', e);
    }

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
    if (!current) return;

    // Disallow marking maintenance if machine is currently running/occupied
    if (current.status === 'occupied' || current.status === 'in_use' || current.timeRemaining > 0) {
      alert(
        `⚠️ Invalid Action: ${current.type === 'washer' ? 'Washing machine' : 'Dryer'} ${machineCode} is currently running!\n\nYou cannot mark a machine as under maintenance while a customer cycle is active.`
      );
      return;
    }

    const nextStatus = current.status === 'maintenance' ? 'available' : 'maintenance';

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
    const current = machines.find((m) => m.code === machineCode);

    // Prevent deleting an active machine
    if (current && (current.status === 'occupied' || current.status === 'in_use' || current.timeRemaining > 0)) {
      alert(`⚠️ Invalid Action: Machine ${machineCode} is currently running! You cannot delete a machine while a session is active.`);
      return;
    }

    // First confirmation
    const firstConfirm = window.confirm(`Are you sure you want to delete machine ${machineCode} from the floor?`);
    if (!firstConfirm) return;

    // Second / Reconfirmation: "Are you willing to do that?"
    const secondConfirm = window.confirm(
      `⚠️ Double Confirmation Required:\n\nAre you willing to do that?\n\nThis will permanently delete machine ${machineCode} and its associated QR code. Click OK to confirm or Cancel to keep the machine.`
    );
    if (!secondConfirm) return;

    try {
      await fetch(`http://${apiHost}:8000/api/machines/${machineCode}/`, {
        method: 'DELETE'
      });
      fetchBackendMachines();
      if (selectedQrMachine === machineCode) {
        setSelectedQrMachine(machines[0]?.code || 'W-1');
      }
      alert(`Machine ${machineCode} has been successfully deleted.`);
    } catch (err) {
      console.warn('Failed to deactivate machine on backend:', err);
      alert(`Failed to delete machine: ${err.message}`);
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

  // Change Owner Password Handler (Connected to Django backend /api/auth/change-password/)
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSettingsStatus(null);

    if (!isOtpResetFlow && !currentPasswordInput) {
      setSettingsStatus({
        type: 'error',
        message: 'Current password is required.'
      });
      return;
    }

    if (newPasswordInput.length < 6) {
      setSettingsStatus({
        type: 'error',
        message: 'New password must be at least 6 characters long.'
      });
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setSettingsStatus({
        type: 'error',
        message: 'New password and confirmation password do not match.'
      });
      return;
    }

    try {
      const payload = {
        username: authStatus.username || 'admin',
        new_password: newPasswordInput,
        skip_current_password: isOtpResetFlow
      };
      if (!isOtpResetFlow) {
        payload.current_password = currentPasswordInput;
      }

      let res = await fetch('/api/auth/change-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/auth/change-password/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      const nowIso = data.updated_at || new Date().toISOString();
      localStorage.setItem('spin_owner_password_updated_at', nowIso);
      setStoredPasswordTime(nowIso);

      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setIsOtpResetFlow(false);

      setSettingsStatus({
        type: 'success',
        message: 'Password successfully changed and synced with backend database! Your new password is now active across all devices.'
      });
      fetchAuthStatus();
    } catch (err) {
      setSettingsStatus({
        type: 'error',
        message: err.message
      });
    }
  };

  // Reset Owner Password to Default Handler (Connected to Django backend /api/auth/reset-password/)
  const handleResetPassword = async () => {
    const isConfirmed = window.confirm(
      'Are you sure you want to reset your owner portal password in SQLite to the system default password?'
    );
    if (!isConfirmed) return;

    try {
      let res = await fetch('/api/auth/reset-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authStatus.username || 'admin'
        })
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/auth/reset-password/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authStatus.username || 'admin'
          })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      localStorage.removeItem('spin_owner_password_updated_at');
      setStoredPasswordTime(null);

      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');

      setSettingsStatus({
        type: 'success',
        message: 'Password has been successfully reset to system default in SQLite database.'
      });
      fetchAuthStatus();
    } catch (err) {
      setSettingsStatus({
        type: 'error',
        message: err.message
      });
    }
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
  const maintenanceDryers = dryers.filter((m) => m.status === 'maintenance').length;

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

  // Filtered customer sessions for Reports view
  const filteredReportSessions = customers.filter((c) => {
    let matchesDate = true;
    if (reportStartDate && reportEndDate) {
      matchesDate = c.rawDate >= reportStartDate && c.rawDate <= reportEndDate;
    } else if (reportStartDate) {
      matchesDate = c.rawDate >= reportStartDate;
    } else if (reportEndDate) {
      matchesDate = c.rawDate <= reportEndDate;
    }
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
      customerName: activeSession?.name || 'Customer Load',
      service: activeSession?.service || (machine.type === 'washer' ? 'Wash' : 'Dry')
    };
  };

  const selectedMachineObj = machines.find((m) => m.code === selectedQrMachine) || machines[0];

  const renderConnectionPill = (extraClassName = '') => (
    <button
      type="button"
      className={`demo-pill ${
        networkStatus === 'online'
          ? 'pill-live'
          : networkStatus === 'slow'
            ? 'pill-slow'
            : 'pill-offline'
      } ${extraClassName}`.trim()}
      onClick={handleToggleOrCheckConnection}
      title={
        isCheckingConnection
          ? 'Testing server connection speed...'
          : networkStatus === 'online'
            ? `Connected · Live portal synced (${lastLatencyMs ? `${lastLatencyMs}ms · ` : ''}Click to refresh)`
            : networkStatus === 'slow'
              ? `Low internet / slow connection (${lastLatencyMs ? `${lastLatencyMs}ms · ` : ''}Click to re-test)`
              : 'Offline · Unable to reach server (Click to reconnect)'
      }
      aria-live="polite"
    >
      <span
        className={
          networkStatus === 'online'
            ? 'live-dot-pulse'
            : networkStatus === 'slow'
              ? 'slow-dot-pulse'
              : 'offline-dot-pulse'
        }
      />
      <span>
        {isCheckingConnection
          ? 'Testing...'
          : networkStatus === 'online'
            ? 'Live portal'
            : networkStatus === 'slow'
              ? 'Low internet'
              : 'Offline'}
      </span>
    </button>
  );

  return (
    <div className={`dashboard-layout ${showChangePasswordPrompt ? 'blurred-for-prompt' : ''}`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ================= LEFT SIDEBAR ================= */}
      <aside className={`owner-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        {/* Brand + Mobile Close */}
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
              <span className="sidebar-brand-title">SanielSoft ai</span>
              <span className="sidebar-brand-sub">OWNER PORTAL</span>
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <XIcon size={20} />
          </button>
        </div>

        {/* Nav Menu */}
        <nav className="sidebar-nav">
          <button
            className={`nav-item-btn ${activeNav === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveNav('overview'); setSidebarOpen(false); }}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>

          <button
            className={`nav-item-btn ${activeNav === 'qr' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('overview');
              setSidebarOpen(false);
              setTimeout(() => {
                const el = document.getElementById('qr-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
          >
            <QrCode size={18} />
            <span>QR labels</span>
          </button>

          <button
            className={`nav-item-btn ${activeNav === 'machines' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('overview');
              setSidebarOpen(false);
              setTimeout(() => {
                const el = document.getElementById('machines-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
          >
            <Layers size={18} />
            <span>Machines</span>
            <span className="nav-badge">{totalMachines}</span>
          </button>

          <button
            className={`nav-item-btn ${activeNav === 'customers' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('overview');
              setSidebarOpen(false);
              setTimeout(() => {
                const el = document.getElementById('sessions-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
          >
            <Users size={18} />
            <span>Customers</span>
            <span className="nav-badge">{customers.length}</span>
          </button>

          <button
            className={`nav-item-btn ${activeNav === 'reports' ? 'active' : ''}`}
            onClick={() => { setActiveNav('reports'); setSidebarOpen(false); }}
          >
            <BarChart3 size={18} />
            <span>Reports</span>
          </button>

          <button
            className={`nav-item-btn ${activeNav === 'activity' ? 'active' : ''}`}
            onClick={() => { setActiveNav('activity'); setSidebarOpen(false); }}
          >
            <Activity size={18} />
            <span>Activity</span>
          </button>

          <div className="nav-group-label">WORKSPACE</div>

          <button
            className={`nav-item-btn ${activeNav === 'security' ? 'active' : ''}`}
            onClick={() => { setActiveNav('security'); setSidebarOpen(false); }}
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
            <div className="owner-avatar">SZ</div>
            <div className="owner-profile-info">
              <span className="owner-name">Store Admin</span>
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
        {/* Mobile Brand Header — SanielSoft ai Name & Logo above Owner / Overview (mobile only) */}
        <div className="mobile-brand-bar">
          <div className="mobile-brand-left">
            <div className="brand-icon mobile-brand-icon">
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
              <span className="mobile-brand-title">SanielSoft ai</span>
              <span className="mobile-brand-sub">OWNER PORTAL</span>
            </div>
          </div>
          <div className="mobile-brand-right">
            {renderConnectionPill('mobile-brand-pill')}
          </div>
        </div>

        {/* Top Header Bar */}
        <header className="main-topbar">
          {/* Hamburger — mobile only */}
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>

          <div className="breadcrumbs">
            <span>Owner portal</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">
              {activeNav === 'reports'
                ? 'Reports & Analytics'
                : activeNav === 'settings' || activeNav === 'security'
                  ? 'Access Settings'
                  : activeNav === 'activity'
                    ? 'Usage Analytics'
                    : 'Overview'}
            </span>
          </div>

          <div className="topbar-right desktop-topbar-right">
            {renderConnectionPill('desktop-topbar-pill')}
            <span className="current-date-text">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
        </header>

        {activeNav === 'settings' || activeNav === 'security' ? (
          /* ================= ACCESS & SECURITY SETTINGS (PASSWORD & CREDENTIALS) ================= */
          <div className="settings-view-container">
            <div className="settings-header-card">
              <div className="settings-header-left">
                <div className="settings-icon-bubble">
                  <Sliders size={24} color="#028a5d" />
                </div>
                <div>
                  <h1 className="settings-title">Access &amp; Security Settings</h1>
                  <p className="settings-subtitle">
                    Manage owner account credentials, reset authentication keys, and update portal sign-in password.
                  </p>
                </div>
              </div>
              <span className="status-chip chip-green">
                • Protected Session
              </span>
            </div>

            {settingsStatus && (
              <div className={`settings-alert-banner ${settingsStatus.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                {settingsStatus.type === 'success' ? (
                  <CheckCircle size={18} className="alert-icon-success" />
                ) : (
                  <AlertTriangle size={18} className="alert-icon-error" />
                )}
                <span>{settingsStatus.message}</span>
                <button
                  type="button"
                  className="alert-close-btn"
                  onClick={() => setSettingsStatus(null)}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="settings-grid">
              {/* Card 1: Change Password Form */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-icon-title">
                    <Lock size={20} className="card-hdr-icon" />
                    <div>
                      <h3 className="settings-card-title">Change Password</h3>
                      <p className="settings-card-desc">
                        Update your portal password to keep your store management secure.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="settings-form">
                  {isOtpResetFlow && (
                    <div className="otp-reset-banner">
                      <CheckCircle size={16} className="text-green" />
                      <div>
                        <strong>OTP Verified Access:</strong> You signed in via one-time recovery code. Entering your old password is not required.
                      </div>
                    </div>
                  )}

                  {!isOtpResetFlow && (
                    <div className="settings-field">
                      <label className="settings-label">Current Password</label>
                      <div className="settings-input-wrapper">
                        <Lock size={16} className="settings-field-icon" />
                        <input
                          type={showCurrentPass ? 'text' : 'password'}
                          placeholder="Enter current password"
                          value={currentPasswordInput}
                          onChange={(e) => setCurrentPasswordInput(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="settings-eye-btn"
                          onClick={() => setShowCurrentPass(!showCurrentPass)}
                        >
                          {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="settings-field">
                    <label className="settings-label">New Password</label>
                    <div className="settings-input-wrapper">
                      <KeyRound size={16} className="settings-field-icon" />
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="settings-eye-btn"
                        onClick={() => setShowNewPass(!showNewPass)}
                      >
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Confirm New Password</label>
                    <div className="settings-input-wrapper">
                      <KeyRound size={16} className="settings-field-icon" />
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        placeholder="Re-type new password"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className="settings-eye-btn"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                      >
                        {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="settings-action-row">
                    <button type="submit" className="btn-save-settings">
                      <Check size={16} />
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Card 2: Reset Password & Credentials Overview */}
              <div className="settings-side-col">
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div className="settings-card-icon-title">
                      <RefreshCw size={20} className="card-hdr-icon text-orange" />
                      <div>
                        <h3 className="settings-card-title">Reset Password</h3>
                        <p className="settings-card-desc">
                          Need to restore default credentials? Reset your account password back to default.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="reset-card-body">
                    <p className="reset-hint-text">
                      Resetting will restore the owner portal password in the database to the system default configured on your server.
                    </p>

                    <button
                      type="button"
                      className="btn-reset-password"
                      onClick={handleResetPassword}
                    >
                      <RefreshCw size={15} />
                      <span>Reset to Default Password</span>
                    </button>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="settings-card-header">
                    <div className="settings-card-icon-title">
                      <ShieldCheck size={20} className="card-hdr-icon text-green" />
                      <div>
                        <h3 className="settings-card-title">Owner Credentials</h3>
                        <p className="settings-card-desc">
                          Current authentication state and account details.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="profile-credentials-list">
                    <div className="cred-row">
                      <span className="cred-label">Username</span>
                      <span className="cred-value">{authStatus.username || 'admin'}</span>
                    </div>
                    <div className="cred-row">
                      <span className="cred-label">Account Role</span>
                      <span className="cred-value">Store Owner (Admin)</span>
                    </div>
                    <div className="cred-row">
                      <span className="cred-label">Password Status</span>
                      <span className="cred-value">
                        {!authStatus.is_default_password ? (
                          <span className="badge-custom-pass">
                            Custom (Active)
                          </span>
                        ) : (
                          <span className="badge-default-pass">System Default</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Google Recovery Email */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div className="settings-card-icon-title">
                      <Mail size={20} className="card-hdr-icon text-blue" />
                      <div>
                        <h3 className="settings-card-title">Google Recovery Email</h3>
                        <p className="settings-card-desc">
                          Emergency email used to send 6-digit OTP codes if you forget your password.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="recovery-email-card-body">
                    <div className="recovery-email-status-row">
                      <div className="recovery-email-info">
                        <span className="recovery-email-label">Registered Google Account</span>
                        <span className="recovery-email-text">{recoveryEmail || 'No Google account linked'}</span>
                      </div>
                      <span className={`status-chip ${isRecoveryEmailVerified && recoveryEmail ? 'chip-green' : 'chip-orange'}`}>
                        {isRecoveryEmailVerified && recoveryEmail ? '• Verified' : '• Action Required'}
                      </span>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                      <button
                        type="button"
                        className="btn-update-email"
                        onClick={() => {
                          setGoogleEmailInput(recoveryEmail || '');
                          setGoogleVerifyError('');
                          setIsGoogleVerifyModalOpen(true);
                        }}
                      >
                        <Edit3 size={15} />
                        <span>{recoveryEmail ? 'Update Recovery Google Email' : 'Link Google Email'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeNav === 'activity' ? (
          /* ================= ACTIVITY & USAGE ANALYTICS (EXACT PDF REPRODUCTION) ================= */
          <ActivityAnalyticsView apiHost={apiHost} />
        ) : activeNav !== 'reports' ? (
          <>
            {/* Title & Action Section */}
            <div className="dashboard-title-row">
              <div>
                <h1 className="dash-heading">The day, at a glance.</h1>
                <p className="dash-subheading">
                  Store overview - {totalMachines} machines across wash and dry.
                </p>
              </div>

              <button className="add-machine-btn" onClick={() => setIsAddModalOpen(true)}>
                <Plus size={18} />
                <span>Add machine</span>
              </button>
            </div>

            {/* ================= 4 METRICS KPI CARDS ================= */}
            {isInitialLoading ? (
              <SkeletonKPIGrid count={4} />
            ) : (
              <div className="kpi-grid">
                {/* Card 1: Available Now */}
                <div className={`kpi-card ${availableCount > 0 ? 'card-available' : 'card-available-empty'}`}>
                  <div className="kpi-avail-top">
                    <span className="kpi-label">Available now</span>
                    <span className="kpi-avail-badge">
                      {availableCount > 0 ? 'Ready' : 'All Busy'}
                    </span>
                  </div>
                  <div className="kpi-value-row">
                    <span className="kpi-big-num">{availableCount}</span>
                    <span className="kpi-total-num">/ {totalMachines} machines</span>
                  </div>
                  <span className="kpi-footer-text">
                    {availableCount > 0
                      ? `${availableWashers} washer · ${availableDryers} dryers ready`
                      : '0 machines currently available'}
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
                    {washers.length > 0 ? (
                      washers.map((w) => (
                        <div
                          key={w.code}
                          title={`${w.code}: ${w.status === 'occupied' ? 'Occupied' : w.status === 'maintenance' ? 'Maintenance' : 'Available'}`}
                          className={`bar-chunk ${w.status === 'occupied' ? 'chunk-blue' : w.status === 'maintenance' ? 'chunk-orange' : 'chunk-light'
                            }`}
                        />
                      ))
                    ) : (
                      <div className="bar-chunk chunk-light" title="No washers configured" />
                    )}
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
                    {dryers.length > 0 ? (
                      dryers.map((d) => (
                        <div
                          key={d.code}
                          title={`${d.code}: ${d.status === 'occupied' ? 'Occupied' : d.status === 'maintenance' ? 'Maintenance' : 'Available'}`}
                          className={`bar-chunk ${d.status === 'occupied' ? 'chunk-blue' : d.status === 'maintenance' ? 'chunk-orange' : 'chunk-light'
                            }`}
                        />
                      ))
                    ) : (
                      <div className="bar-chunk chunk-light" title="No dryers configured" />
                    )}
                  </div>
                  <span className="kpi-footer-text">
                    {availableDryers} available · {maintenanceDryers} maintenance
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
            )}

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
              {isInitialLoading ? (
                <SkeletonMachineGrid count={8} />
              ) : (
                <div className="machine-cards-grid">
                  {filteredMachines.map((m) => {
                    const timer = getMachineTimer(m);

                    return (
                      <div key={m.code} className="machine-floor-card">
                        <div className="floor-card-top">
                          <div className="code-badge-wrap">
                            <span className="machine-icon-tag">{m.type === 'washer' ? '🧺' : '🌀'}</span>
                            <span className="machine-code-text">{m.code}</span>
                          </div>

                          <div className="floor-card-top-right">
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
                        </div>

                        <div className="floor-card-body">
                          {m.status === 'occupied' && (
                            <>
                              <h4 className="floor-primary-text">{timer.label}</h4>
                              <p className="floor-sub-text">{timer.customerName || m.customer || 'Active session'}</p>
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
                            type="button"
                            className="floor-btn-action floor-btn-qr"
                            onClick={() => {
                              setSelectedQrMachine(m.code);
                              const el = document.getElementById('qr-section');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            title={`Generate & Print QR Code for ${m.code}`}
                          >
                            <QrCode size={15} />
                            <span>Generate QR</span>
                          </button>

                          <div className="floor-secondary-actions">
                            <button
                              type="button"
                              className={`floor-btn-action floor-btn-maint ${m.status === 'maintenance' ? 'is-in-maintenance' : ''}`}
                              onClick={() => handleToggleMaintenance(m.code)}
                              title={m.status === 'maintenance' ? `Mark ${m.code} as Available` : `Mark ${m.code} under Maintenance`}
                            >
                              {m.status === 'maintenance' ? <CheckCircle size={15} /> : <Wrench size={15} />}
                              <span>{m.status === 'maintenance' ? 'Mark Available' : 'Mark Maintenance'}</span>
                            </button>

                            <button
                              type="button"
                              className="floor-btn-delete"
                              onClick={() => handleRemoveMachine(m.code)}
                              title={`Remove machine ${m.code}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ================= CUSTOMER SESSIONS SECTION ================= */}
            <section id="sessions-section" className="dash-section">
              <div className="section-header-row">
                <div className="section-title-group">
                  <h2 className="section-title">Customer sessions</h2>
                  <span className="active-sessions-tag">• {occupiedCount} active</span>
                  {customers.length > 10 && (
                    <span className="scroll-records-badge" title="Showing 10 records at a time with scrollable history">
                      Scroll to view all {customers.length}
                    </span>
                  )}
                </div>

                <span className="masked-toggle-note">
                  Contacts masked by default · Reveal per customer
                </span>
              </div>

              <div className="table-wrapper sessions-table-scroll-container">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>CUSTOMER</th>
                      <th>CONTACT</th>
                      <th>MACHINE</th>
                      <th>SERVICE</th>
                      <th>SESSION STATUS</th>
                      <th>EMAIL NOTIFICATION</th>
                      <th>DETAILS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isInitialLoading ? (
                      <SkeletonTableRows rows={5} columns={7} />
                    ) : customers.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '36px 12px', color: '#64748b' }}>
                          No customer sessions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
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
                            <span className={`status-chip ${c.status === 'completed' ? 'chip-green' : c.status === 'cancelled' ? 'chip-orange' : 'chip-blue'}`}>
                              • {c.status === 'completed' ? 'Completed' : c.status === 'cancelled' ? 'Cancelled' : 'In progress'}
                            </span>
                          </td>
                          <td>
                            {c.realEmail && c.realEmail.includes('@laundromat.local') ? (
                              <span className="notif-badge walkin" title="Walk-in customer (No email provided)">
                                Walk-in (Skipped)
                              </span>
                            ) : c.status === 'cancelled' ? (
                              <span className="notif-badge cancelled" title="Session cancelled">
                                Cancelled
                              </span>
                            ) : (
                              <div className="dual-notif-wrap">
                                {/* 1. 5-Min Pre-Alert */}
                                {c.reminderEmailSent ? (
                                  <span className="notif-badge reminder-sent" title={`5-min reminder sent to ${c.realEmail}`}>
                                    <Clock size={11} /> 5-Min: Sent
                                  </span>
                                ) : c.status === 'active' ? (
                                  <span className="notif-badge reminder-pending" title="5-min reminder will send when ~5 minutes remain">
                                    <Clock size={11} /> 5-Min: Pending
                                  </span>
                                ) : (
                                  <span className="notif-badge skipped" title="5-min reminder was skipped (e.g. cycle <= 5 mins or manual completion)">
                                    <Clock size={11} /> 5-Min: Skipped
                                  </span>
                                )}

                                {/* 2. Completion Email */}
                                {c.emailSent ? (
                                  <span className="notif-badge sent" title={`Cycle completion email delivered to ${c.realEmail}`}>
                                    <Mail size={11} /> Finish: Sent
                                  </span>
                                ) : c.status === 'active' ? (
                                  <span className="notif-badge active" title="Completion email scheduled upon cycle finish">
                                    <Mail size={11} /> Finish: Scheduled
                                  </span>
                                ) : (
                                  <span className="notif-badge pending" title="Completion email not dispatched">
                                    <Mail size={11} /> Finish: Not Sent
                                  </span>
                                )}
                              </div>
                            )}
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="table-caption-note">
                Showing all {customers.length} customer records ({occupiedCount} currently active)
                {customers.length > 10 ? ' · Scroll within table to view more' : ''}
              </p>
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
                    download={`sanielsoft-ai-${selectedMachineObj?.code}.png`}
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
          </>
        ) : (
          /* ================= REPORTS & ANALYTICS VIEW ================= */
          <div className="reports-view-container">
            {/* Top Bar / Header */}
            <div className="reports-top-bar">
              <div className="reports-title-col">
                <h1>Business Reports &amp; Analytics</h1>
                <p>
                  Date range machine usage, customer footfall tracking, full session CRUD &amp; multi-format export.
                </p>
              </div>

              <div className="reports-controls-col">
                <button className="btn-export btn-csv" onClick={handleExportXLS} title="Download XLS Report for selected date range">
                  <FileSpreadsheet size={16} />
                  <span>Export XLS</span>
                </button>

                <button className="btn-export btn-pdf" onClick={handleExportPDF} title="Download PDF Report for selected date range">
                  <FileText size={16} />
                  <span>Export PDF</span>
                </button>

                <button className="btn-export btn-record-walkin" onClick={() => setIsManualModalOpen(true)}>
                  <UserPlus size={16} />
                  <span>+ Record Walk-In</span>
                </button>
              </div>
            </div>

            {/* Date Range Presets & Custom Pickers */}
            <div className="reports-filter-section">
              <div className="date-range-presets-row">
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: '4px' }}>
                  Date Filter:
                </span>
                <button
                  type="button"
                  className={`preset-pill-btn ${reportDatePreset === 'all' ? 'active' : ''}`}
                  onClick={() => handleDatePreset('all')}
                >
                  All Time
                </button>
                <button
                  type="button"
                  className={`preset-pill-btn ${reportDatePreset === 'today' ? 'active' : ''}`}
                  onClick={() => handleDatePreset('today')}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`preset-pill-btn ${reportDatePreset === 'week' ? 'active' : ''}`}
                  onClick={() => handleDatePreset('week')}
                >
                  This Week (7 Days)
                </button>
                <button
                  type="button"
                  className={`preset-pill-btn ${reportDatePreset === 'month' ? 'active' : ''}`}
                  onClick={() => handleDatePreset('month')}
                >
                  This Month (30 Days)
                </button>
                <button
                  type="button"
                  className={`preset-pill-btn ${reportDatePreset === 'custom' ? 'active' : ''}`}
                  onClick={() => handleDatePreset('custom')}
                >
                  Custom Range
                </button>
              </div>

              <div className="date-inputs-row">
                <div className="date-input-field-wrap">
                  <Calendar size={14} style={{ color: '#2558ea' }} />
                  <label htmlFor="start-date-input">From:</label>
                  <input
                    id="start-date-input"
                    type="date"
                    className="date-range-picker-input"
                    value={reportStartDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                  />
                </div>

                <div className="date-input-field-wrap">
                  <Calendar size={14} style={{ color: '#2558ea' }} />
                  <label htmlFor="end-date-input">To:</label>
                  <input
                    id="end-date-input"
                    type="date"
                    className="date-range-picker-input"
                    value={reportEndDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                  />
                </div>

                <div className="date-range-badge-indicator">
                  <Calendar size={14} />
                  <span>
                    {reportStartDate && reportEndDate
                      ? (reportStartDate === reportEndDate ? `Single Date: ${reportStartDate}` : `${reportStartDate} → ${reportEndDate}`)
                      : reportStartDate
                        ? `From: ${reportStartDate}`
                        : reportEndDate
                          ? `Until: ${reportEndDate}`
                          : 'All Historical Dates Included'}
                  </span>
                </div>

                {(reportStartDate || reportEndDate) && (
                  <button
                    type="button"
                    onClick={() => handleDatePreset('all')}
                    className="preset-pill-btn"
                    style={{ borderStyle: 'dashed' }}
                    title="Clear date filter"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            {/* Period KPI Metrics Grid */}
            {isReportLoading ? (
              <SkeletonReportKPIGrid count={4} />
            ) : (
              <div className="reports-kpi-grid">
                <div className="report-card">
                  <span className="report-card-label">Total Cycles</span>
                  <span className="report-card-num">{reportAnalytics.summary?.total_sessions ?? 0}</span>
                  <span className="report-card-sub">In selected date period</span>
                </div>

                <div className="report-card">
                  <span className="report-card-label">Unique People Count</span>
                  <span className="report-card-num">{reportAnalytics.summary?.unique_customers ?? 0}</span>
                  <span className="report-card-sub">Individual customers tracked</span>
                </div>

                <div className="report-card">
                  <span className="report-card-label">Session Outcomes</span>
                  <div className="report-outcomes-badges-wrap">
                    <span className="outcome-badge badge-done">
                      <span className="outcome-dot dot-green" />
                      Done <strong>{reportAnalytics.summary?.completed_count ?? 0}</strong>
                    </span>
                    <span className="outcome-badge badge-active">
                      <span className="outcome-dot dot-blue" />
                      Active <strong>{reportAnalytics.summary?.active_count ?? 0}</strong>
                    </span>
                    <span className="outcome-badge badge-cancelled">
                      <span className="outcome-dot dot-orange" />
                      Cancelled <strong>{reportAnalytics.summary?.cancelled_count ?? 0}</strong>
                    </span>
                  </div>
                  <span className="report-card-sub">Completed vs active loads</span>
                </div>

                <div className="report-card">
                  <span className="report-card-label">Total Time &amp; Top Machine</span>
                  <span className="report-card-num">
                    {reportAnalytics.summary?.total_minutes ?? 0} <span style={{ fontSize: '15px', fontWeight: 600, color: '#64748b' }}>mins</span>
                  </span>
                  <span className="report-card-sub">
                    Most active: <strong className="report-card-highlight">{reportAnalytics.summary?.most_active_machine || 'None'}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* DAY-WISE MACHINE USAGE & PEOPLE COUNT TABLE */}
            <section className="dash-section">
              <div className="section-header-row">
                <div className="section-title-group">
                  <h2 className="section-title">Machine Utilization &amp; People Count</h2>
                  <span className="section-count-badge">
                    {reportAnalytics.selected_date === 'all' ? 'All Time' : `Range: ${reportAnalytics.selected_date}`}
                  </span>
                </div>
                <span className="static-note">
                  Number of people who used each specific machine and cycle count
                </span>
              </div>

              <div className="table-wrapper">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>MACHINE CODE</th>
                      <th>MACHINE TYPE</th>
                      <th>CYCLES RUN</th>
                      <th>NUMBER OF PEOPLE USED</th>
                      <th>TOTAL RUNTIME</th>
                      <th>FLOOR STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isReportLoading ? (
                      <SkeletonTableRows rows={4} columns={6} />
                    ) : (reportAnalytics.machine_breakdown && reportAnalytics.machine_breakdown.length > 0) ? (
                      reportAnalytics.machine_breakdown.map((m) => (
                        <tr key={m.code}>
                          <td>
                            <span className="machine-tag-cell">{m.code}</span>
                          </td>
                          <td>
                            <span className="service-text" style={{ textTransform: 'capitalize' }}>
                              {m.type === 'washer' ? '🧺 Washer' : '🌀 Dryer'}
                            </span>
                          </td>
                          <td>
                            <strong style={{ fontSize: '15px', color: '#0b1a44' }}>{m.runs_count}</strong> cycles
                          </td>
                          <td>
                            <span className="people-count-badge">
                              👥 {m.unique_people_count} {m.unique_people_count === 1 ? 'person' : 'people'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{m.total_minutes}</span> mins
                          </td>
                          <td>
                            <span className={`status-chip ${m.status === 'available' ? 'chip-green' : m.status === 'in_use' ? 'chip-blue' : m.status === 'removed' ? 'chip-gray' : 'chip-orange'}`}>
                              • {m.status === 'in_use' ? 'occupied' : m.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                          No machine activity found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* CUSTOMER SESSIONS DATABASE CRUD TABLE */}
            <section className="dash-section">
              <div className="section-header-row" style={{ flexWrap: 'wrap', gap: '12px' }}>
                <div className="section-title-group">
                  <h2 className="section-title">Customer Sessions Database</h2>
                  <span className="active-sessions-tag">{filteredReportSessions.length} records</span>
                </div>

                <div className="filter-bar-row" style={{ margin: 0 }}>
                  <div className="report-search-box">
                    <Search size={15} style={{ color: '#64748b' }} />
                    <input
                      type="text"
                      className="report-search-input"
                      placeholder="Search customer, phone, email, machine..."
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                    />
                    {reportSearch && (
                      <button
                        onClick={() => setReportSearch('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="status-pills-row">
                    {['all', 'active', 'completed', 'cancelled'].map((st) => (
                      <button
                        key={st}
                        className={`status-pill-btn ${reportStatusFilter === st ? 'active' : ''}`}
                        onClick={() => setReportStatusFilter(st)}
                      >
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>

                  <button
                    className="refresh-icon-btn"
                    onClick={() => {
                      fetchBackendSessions();
                      fetchReportAnalytics();
                    }}
                    title="Refresh Data"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              <div className="sessions-table-scroll-container sessions-report-scroll">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>CUSTOMER</th>
                      <th>CONTACT</th>
                      <th>MACHINE</th>
                      <th>DURATION</th>
                      <th>STARTED</th>
                      <th>COMPLETED</th>
                      <th>STATUS</th>
                      <th>EMAIL NOTIFICATION</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isReportLoading ? (
                      <SkeletonTableRows rows={6} columns={9} />
                    ) : filteredReportSessions.length > 0 ? (
                      filteredReportSessions.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <div className="cust-cell">
                              <div className="cust-avatar">{c.initials}</div>
                              <div>
                                <span className="cust-name" style={{ fontWeight: 700 }}>{c.name}</span>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>Session #{c.id}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="contact-cell">
                              <span className="contact-email">{c.revealed ? c.realEmail : c.email}</span>
                              <span className="contact-phone">{c.revealed ? c.realPhone : c.phone}</span>
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
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                              {c.service}
                            </span>
                          </td>
                          <td>
                            <strong>{c.duration || 30}</strong> mins
                          </td>
                          <td>
                            <span style={{ fontSize: '12.5px' }}>{c.startedAt}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '12.5px' }}>{c.completedAt}</span>
                          </td>
                          <td>
                            <span className={`status-chip ${c.status === 'completed' ? 'chip-green' : c.status === 'cancelled' ? 'chip-orange' : 'chip-blue'}`}>
                              • {c.status === 'completed' ? 'Completed' : c.status === 'cancelled' ? 'Cancelled' : 'In progress'}
                            </span>
                          </td>
                          <td>
                            {c.realEmail && c.realEmail.includes('@laundromat.local') ? (
                              <span className="notif-badge walkin" title="Walk-in customer (No email provided)">
                                Walk-in (Skipped)
                              </span>
                            ) : c.status === 'cancelled' ? (
                              <span className="notif-badge cancelled" title="Session cancelled">
                                Cancelled
                              </span>
                            ) : (
                              <div className="dual-notif-wrap">
                                {/* 1. 5-Min Pre-Alert */}
                                {c.reminderEmailSent ? (
                                  <span className="notif-badge reminder-sent" title={`5-min reminder sent to ${c.realEmail}`}>
                                    <Clock size={11} /> 5-Min: Sent
                                  </span>
                                ) : c.status === 'active' ? (
                                  <span className="notif-badge reminder-pending" title="5-min reminder will send when ~5 minutes remain">
                                    <Clock size={11} /> 5-Min: Pending
                                  </span>
                                ) : (
                                  <span className="notif-badge skipped" title="5-min reminder was skipped (e.g. cycle <= 5 mins or manual completion)">
                                    <Clock size={11} /> 5-Min: Skipped
                                  </span>
                                )}

                                {/* 2. Completion Email */}
                                {c.emailSent ? (
                                  <span className="notif-badge sent" title={`Cycle completion email delivered to ${c.realEmail}`}>
                                    <Mail size={11} /> Finish: Sent
                                  </span>
                                ) : c.status === 'active' ? (
                                  <span className="notif-badge active" title="Completion email scheduled upon cycle finish">
                                    <Mail size={11} /> Finish: Scheduled
                                  </span>
                                ) : (
                                  <span className="notif-badge pending" title="Completion email not dispatched">
                                    <Mail size={11} /> Finish: Not Sent
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                className="table-action-btn action-edit"
                                onClick={() => openEditModal(c)}
                                title="Edit Session"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                className="table-action-btn action-delete"
                                onClick={() => handleDeleteSession(c.id)}
                                title="Delete Session"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                          No sessions match the current date and filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="table-caption-note">
                Showing {filteredReportSessions.length} session records · Real-time CRUD synchronization
              </p>
            </section>
          </div>
        )}

        {/* Global Dashboard Footer */}
        <footer className="dash-footer">
          <div className="dash-footer-content">
            <span className="dash-footer-copy">
              Laundromat management application
            </span>
            <div className="dash-footer-powered">
              <span className="powered-by-text">Powered by:</span>
              <img src="/sanielsoft_full_logo.png" alt="SanielSoft" className="sanielsoft-logo-img" />
            </div>
          </div>
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

      {/* ================= MANUAL WALK-IN MODAL (CREATE) ================= */}
      {isManualModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsManualModalOpen(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record Walk-In Session</h3>
              <button className="modal-close-btn" onClick={() => setIsManualModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateManualSession} className="modal-form">
              <div className="modal-field">
                <label>Select Machine</label>
                <select
                  value={manualMachine}
                  onChange={(e) => setManualMachine(e.target.value)}
                  className="modal-select"
                  required
                >
                  {machines.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code} - {m.type === 'washer' ? 'Washer' : 'Dryer'} ({m.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-field">
                <label>Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="modal-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Phone Number (10 digits only)</label>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: manualPhone.length === 10 ? '#059669' : '#64748b' }}>
                    {manualPhone.length}/10 digits
                  </span>
                </div>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  required
                />
              </div>

              <div className="modal-field">
                <label>Email (must contain @ and domain)</label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  required
                />
              </div>

              <div className="modal-field">
                <label>Session Status</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value)}
                  className="modal-select"
                >
                  <option value="completed">Completed (Walk-in already finished)</option>
                  <option value="active">Active (Currently running on floor)</option>
                </select>
              </div>

              <div className="modal-btn-row">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsManualModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn">
                  Save Walk-In Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT SESSION MODAL (UPDATE) ================= */}
      {isEditModalOpen && editingSession && (
        <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Session #{editingSession.id} ({editingSession.machine})</h3>
              <button className="modal-close-btn" onClick={() => setIsEditModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleUpdateSession} className="modal-form">
              <div className="modal-field">
                <label>Customer Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="modal-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Customer Phone (10 digits only)</label>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: editPhone.length === 10 ? '#059669' : '#64748b' }}>
                    {editPhone.length}/10 digits
                  </span>
                </div>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                />
              </div>

              <div className="modal-field">
                <label>Customer Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="customer@example.com"
                  required
                />
              </div>

              <div className="modal-field">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  required
                />
              </div>

              <div className="modal-field">
                <label>Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="modal-select"
                >
                  <option value="completed">Completed</option>
                  <option value="active">Active (In progress)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="modal-btn-row">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= POST-OTP "WANNA CHANGE YOUR PASSWORD?" CARD ================= */}
      {showChangePasswordPrompt && (
        <div className="otp-prompt-backdrop">
          <div className="otp-prompt-card" onClick={(e) => e.stopPropagation()}>
            <div className="otp-prompt-icon-bubble">
              <KeyRound size={28} className="otp-prompt-icon" />
            </div>

            <h2 className="otp-prompt-title">Wanna change your password?</h2>
            <p className="otp-prompt-subtitle">
              You logged in using a one-time OTP recovery code. Would you like to create a new, permanent password to keep your owner account secure?
            </p>

            <div className="otp-prompt-actions">
              <button
                type="button"
                className="otp-prompt-btn-confirm"
                onClick={handleOtpPromptLetsGo}
              >
                <span>Let's go</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="otp-prompt-btn-dismiss"
                onClick={handleOtpPromptNotNow}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ONE-TIME GOOGLE EMAIL VERIFICATION MODAL ================= */}
      {isGoogleVerifyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content-card google-verify-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="google-verify-header">
              <div className="google-icon-bubble">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <div className="google-verify-title-col">
                <span className="google-badge-pill">One-time setup</span>
                <h3 className="modal-title">Link Recovery Google Email</h3>
              </div>
            </div>

            <p className="google-verify-desc">
              Connect your Gmail / Google account. This is performed <strong>only once</strong> so that if you ever forget your password, an emergency 6-digit OTP code can be sent to this email to regain portal access.
            </p>

            {googleVerifyError && (
              <div className="google-verify-error-banner">
                <AlertTriangle size={16} />
                <span>{googleVerifyError}</span>
              </div>
            )}

            <form onSubmit={handleSaveGoogleEmail} className="modal-form">
              <div className="modal-field">
                <label>Google / Gmail Address</label>
                <div className="owner-input-wrapper">
                  <Mail size={18} className="field-icon" />
                  <input
                    type="email"
                    placeholder="e.g. owner@gmail.com"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <span className="field-helper-text">
                  Your address is stored in the database for emergency password recovery.
                </span>
              </div>

              <div className="modal-btn-row">
                <button
                  type="submit"
                  className="modal-submit-btn"
                  disabled={googleVerifyLoading}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <CheckCircle size={18} />
                  <span>{googleVerifyLoading ? 'Verifying & Saving...' : 'Save & Verify Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
