import React from 'react';
import {
  Plus,
  Filter,
  Search,
  CheckCircle,
  Wrench,
  Trash2,
  QrCode,
  Download,
  Printer,
  Mail,
  Clock
} from 'lucide-react';

export default function OverviewView({
  // Metrics
  totalMachines,
  availableCount,
  availableWashers,
  availableDryers,
  occupiedWashers,
  washers,
  occupiedDryers,
  dryers,
  occupiedCount,
  
  // Filters & State
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  filteredMachines,
  
  // Modals / Triggers
  setIsAddModalOpen,
  setSelectedDetailMachine,
  handleToggleMaintenance,
  handleRemoveMachine,
  getMachineTimer,
  
  // Sessions
  customers,
  toggleContactReveal,
  
  // QR
  selectedQrMachine,
  setSelectedQrMachine,
  selectedMachineObj,
  qrDataUrl,
  detectedLanIp,
  handlePrintLabel
}) {
  return (
    <>
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
            {washers.length > 0 ? (
              washers.map((w) => (
                <div
                  key={w.code}
                  title={`${w.code}: ${w.status === 'occupied' ? 'Occupied' : w.status === 'maintenance' ? 'Maintenance' : 'Available'}`}
                  className={`bar-chunk ${
                    w.status === 'occupied' ? 'chunk-blue' : w.status === 'maintenance' ? 'chunk-orange' : 'chunk-light'
                  }`}
                />
              ))
            ) : (
              <div className="bar-chunk chunk-light" />
            )}
          </div>
          <span className="kpi-footer-text">
            {occupiedWashers > 0 ? `${occupiedWashers} cycle(s) in motion` : 'All washers open'}
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
                  className={`bar-chunk ${
                    d.status === 'occupied' ? 'chunk-blue' : d.status === 'maintenance' ? 'chunk-orange' : 'chunk-light'
                  }`}
                />
              ))
            ) : (
              <div className="bar-chunk chunk-light" />
            )}
          </div>
          <span className="kpi-footer-text">
            {occupiedDryers > 0 ? `${occupiedDryers} tumble cycle(s) active` : 'All dryers open'}
          </span>
        </div>

        {/* Card 4: Total Machines Registered */}
        <div className="kpi-card">
          <span className="kpi-label">Floor inventory</span>
          <div className="kpi-value-row">
            <span className="kpi-big-num">{totalMachines}</span>
            <span className="kpi-total-num">total tracked</span>
          </div>
          <span className="kpi-footer-text">
            {washers.length} washers · {dryers.length} dryers active
          </span>
        </div>
      </div>

      {/* ================= FILTER / SEARCH BAR ================= */}
      <div className="filter-bar-row">
        {/* Machine Type Filter Pills */}
        <div className="pill-group">
          {['all', 'washer', 'dryer'].map((type) => (
            <button
              key={type}
              type="button"
              className={`filter-pill-btn ${typeFilter === type ? 'active' : ''}`}
              onClick={() => setTypeFilter(type)}
            >
              {type === 'all' ? 'All machines' : type === 'washer' ? 'Washers' : 'Dryers'}
            </button>
          ))}
        </div>

        {/* Status Filter Pills */}
        <div className="pill-group">
          {['all', 'available', 'occupied', 'maintenance'].map((st) => (
            <button
              key={st}
              type="button"
              className={`filter-pill-btn ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="search-input-wrap">
          <Search size={16} className="search-icon-inside" />
          <input
            type="text"
            className="filter-search-input"
            placeholder="Search code, customer or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Reset filter button */}
        {(typeFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
          <button
            type="button"
            className="clear-filters-btn"
            onClick={() => {
              setTypeFilter('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ================= MACHINES FLOOR CARD GRID ================= */}
      <section id="machines-section" className="dash-section">
        <div className="section-header-row">
          <div className="section-title-group">
            <h2 className="section-title">Floor machines</h2>
            <span className="section-count-badge">{filteredMachines.length} shown</span>
          </div>
          <span className="static-note">Live floor status updates automatically</span>
        </div>

        <div className="machines-grid">
          {filteredMachines.map((m) => {
            const timer = getMachineTimer(m);

            return (
              <div
                key={m.code}
                className={`floor-machine-card ${
                  m.status === 'occupied'
                    ? 'status-card-occupied'
                    : m.status === 'maintenance'
                    ? 'status-card-maintenance'
                    : 'status-card-available'
                }`}
              >
                {/* Card Top: Code, Type & Status Tag */}
                <div className="floor-card-header">
                  <div className="machine-code-col">
                    <span className="machine-icon-badge">
                      {m.type === 'washer' ? '🧺' : '🌀'}
                    </span>
                    <div>
                      <h4 className="floor-machine-code">{m.code}</h4>
                      <span className="floor-machine-sub">{m.note || `${m.type} machine`}</span>
                    </div>
                  </div>

                  <span
                    className={`floor-status-badge ${
                      m.status === 'occupied'
                        ? 'badge-occupied'
                        : m.status === 'maintenance'
                        ? 'badge-maintenance'
                        : 'badge-available'
                    }`}
                  >
                    {m.status === 'occupied'
                      ? 'In use'
                      : m.status === 'maintenance'
                      ? 'Under maintenance'
                      : 'Ready for load'}
                  </span>
                </div>

                {/* Card Middle: Telemetry & Countdown Timer */}
                <div className="floor-card-body">
                  <div className="timer-display-wrap">
                    <div className="timer-row">
                      <span className="timer-main-digit">{timer.formatted}</span>
                      <span className="timer-status-hint">{timer.label}</span>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="timer-progress-track">
                      <div
                        className={`timer-progress-fill ${
                          m.status === 'occupied'
                            ? 'fill-active'
                            : m.status === 'maintenance'
                            ? 'fill-maint'
                            : 'fill-ready'
                        }`}
                        style={{ width: `${timer.percent}%` }}
                      >
                        {m.status === 'occupied' && <span className="fill-animated-wave" />}
                      </div>
                    </div>
                  </div>

                  {/* Customer / Service Meta Row */}
                  <div className="floor-meta-row">
                    <div className="meta-col">
                      <span className="meta-label">Customer load</span>
                      <span className="meta-val">{timer.customerName}</span>
                    </div>
                    <div className="meta-col text-right">
                      <span className="meta-label">Service</span>
                      <span className="meta-val">{timer.service}</span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Quick Actions */}
                <div className="floor-card-footer">
                  <button
                    type="button"
                    className="floor-btn-action floor-btn-details"
                    onClick={() => setSelectedDetailMachine(m)}
                    title={`View Live Telemetry for ${m.code}`}
                  >
                    <span>View details</span>
                  </button>

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
                      className={`floor-btn-action floor-btn-maint ${
                        m.status === 'maintenance' ? 'is-in-maintenance' : ''
                      }`}
                      onClick={() => handleToggleMaintenance(m.code)}
                      title={
                        m.status === 'maintenance'
                          ? `Mark ${m.code} as Available`
                          : `Mark ${m.code} under Maintenance`
                      }
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
                <th>EMAIL NOTIFICATION</th>
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
                    {c.status === 'completed' ? (
                      <span className="status-chip chip-green">
                        • Completed
                      </span>
                    ) : c.status === 'active' ? (
                      <div className="session-status-cell">
                        <span className="in-progress-badge">In progress</span>
                        <span className="time-rem-text">{c.timeRemaining}</span>
                      </div>
                    ) : (
                      <span className="status-chip chip-orange">
                        • {c.status}
                      </span>
                    )}
                  </td>
                  <td>
                    {c.status === 'completed' ? (
                      c.emailSent ? (
                        <span className="notif-badge sent" title={`Email dispatched to ${c.realEmail}`}>
                          <Mail size={12} /> Sent
                        </span>
                      ) : c.realEmail && c.realEmail.includes('@laundromat.local') ? (
                        <span className="notif-badge walkin" title="Walk-in (No email provided)">
                          Walk-in
                        </span>
                      ) : (
                        <span className="notif-badge pending" title="Email not dispatched for this session">
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
        <p className="table-caption-note">Showing all {customers.length} customer records ({occupiedCount} currently active)</p>
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
    </>
  );
}
