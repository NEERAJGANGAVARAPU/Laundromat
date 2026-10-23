import React from 'react';

// 1. ADD MACHINE MODAL
export function AddMachineModal({
  isOpen,
  onClose,
  onSubmit,
  newCode,
  setNewCode,
  newType,
  setNewType,
  newStatus,
  setNewStatus,
  newNote,
  setNewNote
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add New Machine</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={onSubmit} className="modal-form">
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
              onClick={onClose}
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
  );
}

// 2. MANUAL WALK-IN SESSION MODAL
export function ManualSessionModal({
  isOpen,
  onClose,
  onSubmit,
  machines,
  manualMachine,
  setManualMachine,
  manualName,
  setManualName,
  manualPhone,
  setManualPhone,
  manualEmail,
  setManualEmail,
  manualDuration,
  setManualDuration,
  manualStatus,
  setManualStatus
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Record Walk-In Session</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={onSubmit} className="modal-form">
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
            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="e.g. +1 555-0199"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              required
            />
          </div>

          <div className="modal-field">
            <label>Email (optional)</label>
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
              onClick={onClose}
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
  );
}

// 3. EDIT SESSION MODAL
export function EditSessionModal({
  isOpen,
  session,
  onClose,
  onSubmit,
  editName,
  setEditName,
  editPhone,
  setEditPhone,
  editEmail,
  setEditEmail,
  editDuration,
  setEditDuration,
  editStatus,
  setEditStatus
}) {
  if (!isOpen || !session) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Session #{session.id} ({session.machine})</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={onSubmit} className="modal-form">
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
            <label>Customer Phone</label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label>Customer Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
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
              onClick={onClose}
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
  );
}

// 4. MACHINE DETAIL MODAL
export function MachineDetailModal({
  machine,
  onClose,
  getMachineTimer
}) {
  if (!machine) return null;
  const timer = getMachineTimer ? getMachineTimer(machine) : { formatted: '00:00', label: machine.status };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Machine Telemetry: {machine.code}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '32px' }}>{machine.type === 'washer' ? '🧺' : '🌀'}</span>
            <div>
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>{machine.code}</h4>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>{machine.note || `${machine.type} unit`}</p>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Current State:</span>
              <strong style={{ textTransform: 'capitalize' }}>{machine.status}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Timer / Countdown:</span>
              <strong>{timer.formatted} ({timer.label})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Current Customer:</span>
              <strong>{timer.customerName || 'None'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Hardware ID:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{machine.id || machine.code}</span>
            </div>
          </div>

          <div className="modal-btn-row">
            <button type="button" className="modal-submit-btn" onClick={onClose} style={{ width: '100%' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
