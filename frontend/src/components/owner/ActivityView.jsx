import React from 'react';
import {
  Search,
  X,
  RefreshCw,
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send
} from 'lucide-react';

export default function ActivityView({
  notificationsList,
  activeSessionsCount,
  activitySearch,
  setActivitySearch,
  fetchNotifications
}) {
  const safeNotifs = Array.isArray(notificationsList) ? notificationsList : [];

  const filteredNotifs = safeNotifs.filter((n) => {
    const q = (activitySearch || '').toLowerCase().trim();
    if (!q) return true;
    return (
      (n.customer_email && n.customer_email.toLowerCase().includes(q)) ||
      (n.machine_code && n.machine_code.toLowerCase().includes(q)) ||
      (n.status && n.status.toLowerCase().includes(q)) ||
      String(n.session_id).includes(q)
    );
  });

  const deliveredCount = safeNotifs.filter((n) => n.status === 'sent').length;
  const deliveryRate = safeNotifs.length > 0 ? Math.round((deliveredCount / safeNotifs.length) * 100) : 100;

  return (
    <div className="activity-view-container">
      {/* Top Bar / Header */}
      <div className="reports-top-bar">
        <div className="reports-title-col">
          <h1>Activity &amp; Notifications</h1>
          <p>
            Real-time track of customer session completions and automated email notification deliveries.
          </p>
        </div>

        <div className="reports-controls-col">
          <button
            className="refresh-icon-btn"
            onClick={fetchNotifications}
            title="Refresh Notification Log"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card">
          <span className="kpi-label">Delivered Notifications</span>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{deliveredCount}</span>
            <span className="kpi-total-num">/ {safeNotifs.length} emails</span>
          </div>
          <span className="kpi-footer-text">
            Customer wash &amp; dry completion alerts
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Active Cycles In-Motion</span>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{activeSessionsCount}</span>
            <span className="kpi-total-num">scheduled to alert</span>
          </div>
          <span className="kpi-footer-text">
            Will dispatch email upon cycle end
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Delivery Success Rate</span>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{deliveryRate}%</span>
          </div>
          <span className="kpi-footer-text">
            Automated background daemon monitor
          </span>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="filter-bar-row" style={{ marginBottom: '16px', justifyContent: 'flex-start' }}>
        <div className="report-search-box" style={{ maxWidth: '420px' }}>
          <Search size={15} style={{ color: '#64748b' }} />
          <input
            type="text"
            className="report-search-input"
            placeholder="Search activity by email, machine or status..."
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
          />
          {activitySearch && (
            <button
              onClick={() => setActivitySearch('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Activity / Notification Table */}
      <section className="dash-section">
        <div className="table-wrapper">
          <table className="sessions-table">
            <thead>
              <tr>
                <th>SENT AT</th>
                <th>SESSION</th>
                <th>RECIPIENT EMAIL</th>
                <th>MACHINE</th>
                <th>CHANNEL</th>
                <th>DELIVERY STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifs.length > 0 ? (
                filteredNotifs.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} style={{ color: '#94a3b8' }} />
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                          {n.sent_at_formatted || n.sent_at}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#0b1a44' }}>
                        Session #{n.session_id}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>
                        {n.customer_email || 'customer@gmail.com'}
                      </span>
                    </td>
                    <td>
                      <span className="machine-tag-cell">{n.machine_code || '-'}</span>
                    </td>
                    <td>
                      <span className="channel-badge">
                        <Mail size={12} /> {n.channel || 'email'}
                      </span>
                    </td>
                    <td>
                      {n.status === 'sent' ? (
                        <span className="notif-badge sent">
                          <CheckCircle size={12} /> Sent &amp; Delivered
                        </span>
                      ) : (
                        <span className="notif-badge pending">
                          {n.status || 'Pending'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    {safeNotifs.length === 0
                      ? 'No email notifications logged yet. New completions will appear here automatically.'
                      : 'No notifications match your search query.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="table-caption-note">
          Showing {filteredNotifs.length} notification delivery logs · Auto-synchronized with database
        </p>
      </section>
    </div>
  );
}
