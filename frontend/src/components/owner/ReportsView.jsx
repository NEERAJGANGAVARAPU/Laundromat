import React from 'react';
import {
  Calendar,
  FileSpreadsheet,
  FileText,
  UserPlus,
  Search,
  X,
  RefreshCw,
  Mail,
  Clock,
  Edit3,
  Trash2
} from 'lucide-react';

export default function ReportsView({
  selectedReportDate,
  setSelectedReportDate,
  reportAnalytics,
  handleExportCSV,
  handleExportPDF,
  setIsManualModalOpen,
  
  // Search & Filter
  reportSearch,
  setReportSearch,
  reportStatusFilter,
  setReportStatusFilter,
  filteredReportSessions,
  
  // Refresh & CRUD
  fetchBackendSessions,
  fetchReportAnalytics,
  toggleContactReveal,
  openEditModal,
  handleDeleteSession
}) {
  return (
    <div className="reports-view-container">
      {/* Top Bar / Header */}
      <div className="reports-top-bar">
        <div className="reports-title-col">
          <h1>Business Reports &amp; Analytics</h1>
          <p>
            Day-by-day machine usage, customer footfall tracking, full session CRUD &amp; multi-format export.
          </p>
        </div>

        <div className="reports-controls-col">
          <div className="date-select-wrapper">
            <Calendar size={16} />
            <select
              value={selectedReportDate}
              onChange={(e) => setSelectedReportDate(e.target.value)}
              className="date-dropdown"
            >
              <option value="all">All Dates Combined</option>
              {reportAnalytics.available_dates && reportAnalytics.available_dates.map((d) => (
                <option key={d} value={d}>
                  {d} {d === new Date().toISOString().split('T')[0] ? '(Today)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button className="btn-export btn-csv" onClick={handleExportCSV} title="Download CSV Report">
            <FileSpreadsheet size={16} />
            <span>Export CSV</span>
          </button>

          <button className="btn-export btn-pdf" onClick={handleExportPDF} title="Download PDF Report">
            <FileText size={16} />
            <span>Export PDF</span>
          </button>

          <button className="btn-export btn-record-walkin" onClick={() => setIsManualModalOpen(true)}>
            <UserPlus size={16} />
            <span>+ Record Walk-In</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card">
          <span className="kpi-label">Total Day Usage</span>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{reportAnalytics.summary?.total_sessions || 0}</span>
            <span className="kpi-total-num">sessions run</span>
          </div>
          <span className="kpi-footer-text">
            {reportAnalytics.summary?.completed_count || 0} completed · {reportAnalytics.summary?.active_count || 0} active
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Unique Visitors</span>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{reportAnalytics.summary?.unique_customers || 0}</span>
            <span className="kpi-total-num">distinct people</span>
          </div>
          <span className="kpi-footer-text">
            Across wash and dry cycles
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Machine Efficiency</span>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{reportAnalytics.summary?.total_minutes || 0}</span>
            <span className="kpi-total-num">mins operated</span>
          </div>
          <span className="kpi-footer-text">
            Top machine: <strong>{reportAnalytics.summary?.most_active_machine || 'N/A'}</strong>
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Day Footfall Status</span>
          <div className="kpi-value-row">
            <span className="kpi-big-num">
              {reportAnalytics.summary?.total_sessions > 15 ? 'Peak Day' : reportAnalytics.summary?.total_sessions > 5 ? 'Steady' : 'Light'}
            </span>
          </div>
          <span className="kpi-footer-text">
            {reportAnalytics.selected_date === 'all' ? 'Across all database dates' : `Date: ${reportAnalytics.selected_date}`}
          </span>
        </div>
      </div>

      {/* Machine Breakdown Grid */}
      {reportAnalytics.machine_breakdown && reportAnalytics.machine_breakdown.length > 0 && (
        <div className="analytics-breakdown-card">
          <h3 className="breakdown-title">Machine Usage Breakdown ({selectedReportDate === 'all' ? 'All Time' : selectedReportDate})</h3>
          <div className="breakdown-grid">
            {reportAnalytics.machine_breakdown.map((mb) => (
              <div key={mb.code} className="breakdown-item">
                <div className="mb-header">
                  <span className="mb-code">{mb.code}</span>
                  <span className="mb-type">{mb.type}</span>
                </div>
                <div className="mb-stats">
                  <div><strong>{mb.session_count}</strong> sessions</div>
                  <div><strong>{mb.total_minutes}</strong> mins</div>
                  <div className="mb-completed">{mb.completed} finished</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                fetchReportAnalytics(selectedReportDate);
              }}
              title="Refresh Data"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        <div className="table-wrapper">
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
              {filteredReportSessions.length > 0 ? (
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
                      <span className={`status-chip ${c.status === 'completed' ? 'chip-green' : c.status === 'active' ? 'chip-blue' : 'chip-orange'}`}>
                        • {c.status}
                      </span>
                    </td>
                    <td>
                      {c.status === 'completed' ? (
                        c.emailSent ? (
                          <span className="notif-badge sent" title={`Email sent to ${c.realEmail}`}>
                            <Mail size={12} /> Sent
                          </span>
                        ) : c.realEmail && c.realEmail.includes('@laundromat.local') ? (
                          <span className="notif-badge walkin" title="Walk-in (No email provided)">
                            Walk-in
                          </span>
                        ) : (
                          <span className="notif-badge pending" title="Email not dispatched for this historical session">
                            <Mail size={12} /> Not Sent
                          </span>
                        )
                      ) : c.status === 'active' ? (
                        <span className="notif-badge active" title="Scheduled upon cycle finish">
                          <Clock size={12} /> Scheduled
                        </span>
                      ) : (
                        <span className="notif-badge cancelled" title="Session cancelled">
                          Cancelled
                        </span>
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
  );
}
