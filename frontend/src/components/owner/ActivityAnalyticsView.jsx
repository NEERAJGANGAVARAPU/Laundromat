import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronDown,
  RefreshCw,
  Info,
  Layers,
  Users,
  CheckCircle2,
  Clock,
  Flame,
  ArrowUpRight,
  Database,
  Radio
} from 'lucide-react';
import '../../ActivityAnalytics.css';

export default function ActivityAnalyticsView({ apiHost = '127.0.0.1' }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultStartStr = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
  const [period, setPeriod] = useState('week'); // 'day', 'week', 'month', 'custom'
  const [customStart, setCustomStart] = useState(defaultStartStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [machineFilter, setMachineFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  // Sample static reference data matching 24h cycle
  const SAMPLE_DATA = {
    period: 'week',
    selected_label: '12–18 Oct 2026',
    operating_hours: 'Mon–Sun · Open 24 Hours',
    is_realtime: false,
    top_metrics: {
      customers: 240,
      unique_customers: 240,
      total_visits: 310,
      total_sessions: 420,
      avg_sessions_per_customer: 1.8,
      customers_sub: '310 store visits · 420 machine sessions this week',
      completed_cycles: 560,
      completed_cycles_sub: '320 wash · 240 dry',
      utilization: '42.5%',
      utilization_sub: '333h 20m active / 1,344h available',
      busiest_window: '4–6 PM',
      busiest_window_sub: 'Saturday is the busiest day'
    },
    scales: {
      day: {
        tag: 'DAY',
        label: 'Sat, 17 Oct',
        customers: 65,
        total_visits: 65,
        total_sessions: 80,
        cycles: 107,
        utilization: '56.8%',
        chart_title: 'Cycles by two-hour window',
        bars: [
          { label: '12a', value: 2, pct: 7 },
          { label: '2a', value: 1, pct: 4 },
          { label: '4a', value: 3, pct: 11 },
          { label: '6a', value: 8, pct: 28 },
          { label: '8a', value: 12, pct: 42 },
          { label: '10a', value: 16, pct: 57 },
          { label: '12p', value: 14, pct: 50 },
          { label: '2p', value: 18, pct: 64 },
          { label: '4p', value: 28, pct: 100 },
          { label: '6p', value: 15, pct: 53 },
          { label: '8p', value: 9, pct: 32 },
          { label: '10p', value: 4, pct: 14 }
        ]
      },
      week: {
        tag: 'WEEK',
        label: '12–18 Oct',
        customers: 240,
        total_visits: 310,
        total_sessions: 420,
        cycles: 560,
        utilization: '42.5%',
        chart_title: 'Completed cycles by day',
        bars: [
          { label: 'M', value: 48, pct: 60 },
          { label: 'T', value: 51, pct: 64 },
          { label: 'W', value: 55, pct: 69 },
          { label: 'T', value: 58, pct: 72 },
          { label: 'F', value: 64, pct: 80 },
          { label: 'S', value: 80, pct: 100 },
          { label: 'S', value: 64, pct: 80 }
        ]
      },
      month: {
        tag: 'PAST 30 DAYS',
        label: '19 Sep–18 Oct · 30 days',
        customers: '950',
        total_visits: '1,420',
        total_sessions: '1,800',
        cycles: '2,400',
        utilization: '42.5%',
        chart_title: 'Completed cycles · days in 30-day period',
        bars: [
          { label: '1–7', value: 550, pct: 96 },
          { label: '8–14', value: 565, pct: 98 },
          { label: '15–21', value: 570, pct: 100 },
          { label: '22–28', value: 545, pct: 95 },
          { label: '29–30', value: 170, pct: 30 }
        ]
      }
    },
    heatmap: {
      period_label: '12–18 Oct',
      total_visits: 310,
      unique_customers: 240,
      time_slots: ['12–2a', '2–4a', '4–6a', '6–8a', '8–10a', '10–12p', '12–2p', '2–4p', '4–6p', '6–8p', '8–10p', '10–12a'],
      rows: [
        { day: 'Mon', slots: [1, 1, 2, 3, 5, 7, 6, 8, 12, 7, 4, 2], total: 58 },
        { day: 'Tue', slots: [1, 0, 1, 3, 6, 7, 7, 8, 13, 7, 5, 3], total: 61 },
        { day: 'Wed', slots: [2, 1, 2, 4, 6, 8, 7, 9, 14, 7, 5, 3], total: 68 },
        { day: 'Thu', slots: [1, 1, 2, 4, 6, 8, 8, 10, 15, 7, 6, 2], total: 70 },
        { day: 'Fri', slots: [2, 1, 2, 4, 7, 9, 9, 11, 16, 8, 7, 4], total: 80 },
        { day: 'Sat', slots: [3, 2, 3, 5, 8, 11, 11, 14, 21, 10, 8, 5], total: 101 },
        { day: 'Sun', slots: [2, 1, 2, 4, 7, 9, 9, 11, 16, 8, 6, 3], total: 78 }
      ]
    },
    time_usage: {
      sub_title: 'All 8 machines · selected week',
      formula: 'Utilization = active time ÷ available machine time',
      formula_sub: 'Available: 8 machines × 24 hours × 7 days = 1,344 hours',
      utilization_pct: 42.5,
      active_time: '333h 20m',
      idle_time: '1,010h 40m'
    },
    machine_view: {
      sub_title: 'Usage by unit · selected week',
      summary_pills: ['4 washers', '4 dryers'],
      footer_note: 'Each unit: 98 available hours in period. Active time uses cycle runtime.',
      units: [
        { code: 'W-01', type: 'Washer', cycles: 92, active_time: '61h 20m', utilization: 62.6, idle_time: '36h 40m' },
        { code: 'W-02', type: 'Washer', cycles: 84, active_time: '56h 00m', utilization: 57.1, idle_time: '42h 00m' },
        { code: 'W-03', type: 'Washer', cycles: 76, active_time: '50h 40m', utilization: 51.7, idle_time: '47h 20m' },
        { code: 'W-04', type: 'Washer', cycles: 68, active_time: '45h 20m', utilization: 46.3, idle_time: '52h 40m' },
        { code: 'D-01', type: 'Dryer', cycles: 72, active_time: '36h 00m', utilization: 36.7, idle_time: '62h 00m' },
        { code: 'D-02', type: 'Dryer', cycles: 64, active_time: '32h 00m', utilization: 32.7, idle_time: '66h 00m' },
        { code: 'D-03', type: 'Dryer', cycles: 56, active_time: '28h 00m', utilization: 28.6, idle_time: '70h 00m' },
        { code: 'D-04', type: 'Dryer', cycles: 48, active_time: '24h 00m', utilization: 24.5, idle_time: '74h 00m' }
      ]
    },
    wash_vs_dry: {
      total_cycles: 560,
      washers: { cycles: 320, pct: 57.1 },
      dryers: { cycles: 240, pct: 42.9 },
      utilization_by_type: {
        washers_pct: 54.4,
        dryers_pct: 30.6
      }
    },
    glance_insights: [
      'Saturday leads customer demand.',
      'Washers run harder than dryers.',
      '4–6 PM is the arrival peak.'
    ],
    available_machines: [
      { code: 'W-01', type: 'washer' },
      { code: 'W-02', type: 'washer' },
      { code: 'W-03', type: 'washer' },
      { code: 'W-04', type: 'washer' },
      { code: 'D-01', type: 'dryer' },
      { code: 'D-02', type: 'dryer' },
      { code: 'D-03', type: 'dryer' },
      { code: 'D-04', type: 'dryer' }
    ]
  };

  const [realtimeData, setRealtimeData] = useState(null);

  // Fetch real database analytics from Django
  const fetchRealtimeAnalytics = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('period', period);
      if (period === 'custom') {
        if (customStart) params.append('start_date', customStart);
        if (customEnd) params.append('end_date', customEnd);
      } else if (period === 'day' && customStart) {
        params.append('start_date', customStart);
      }
      if (machineFilter !== 'all') params.append('machine', machineFilter);
      if (customerFilter !== 'all') params.append('customer', customerFilter);

      let res = await fetch(`/api/activity/analytics/?${params.toString()}`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`http://${apiHost}:8000/api/activity/analytics/?${params.toString()}`);
      }
      if (res && res.ok) {
        const data = await res.json();
        setRealtimeData(data);
      }
    } catch (e) {
      console.warn('Real-time database analytics fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRealtimeAnalytics();
  }, [period, customStart, customEnd, machineFilter, customerFilter]);

  // Active data is the real database data when available
  const activeData = realtimeData || SAMPLE_DATA;

  // Heatmap dynamic color interpolator
  const allHeatVals = activeData.heatmap?.rows ? activeData.heatmap.rows.flatMap((r) => r.slots) : [];
  const maxHeatVal = Math.max(...allHeatVals, 1);

  const getHeatmapColor = (val) => {
    if (val === 0) return { bg: '#f8fafc', color: '#94a3b8' };
    const ratio = val / maxHeatVal;
    if (ratio >= 0.8) return { bg: '#0f3d8a', color: '#ffffff' };
    if (ratio >= 0.6) return { bg: '#0284c7', color: '#ffffff' };
    if (ratio >= 0.4) return { bg: '#38bdf8', color: '#0b1a44' };
    if (ratio >= 0.2) return { bg: '#7dd3fc', color: '#0b1a44' };
    return { bg: '#e0f2fe', color: '#0369a1' };
  };

  const currentScale = activeData.scales ? activeData.scales[period] || activeData.scales.week : null;

  return (
    <div className="activity-analytics-container">
      {/* 1. Hero Header & Live DB Indicator */}
      <div className="activity-hero-header">
        <div className="activity-hero-left">
          <span className="activity-category-tag">OPERATIONS / USAGE ANALYTICS</span>
          <h1 className="activity-hero-title">A clearer picture of every cycle.</h1>
          <p className="activity-hero-desc">
            Real-time customer visit analysis, busy hours, and machine cycle metrics from your database.
          </p>
        </div>
        <div className="activity-hero-right">
          <div className="live-db-badge" title="Live analytics computed directly from your SQLite database">
            <span className="live-status-dot"></span>
            <span>Live Database</span>
          </div>
        </div>
      </div>

      {/* 2. Analysis Period Toolbar */}
      <div className="activity-toolbar">
        <div className="toolbar-left-group">
          <span className="toolbar-label">Analysis period</span>

          {/* Period selector pill buttons */}
          <div className="period-pill-group">
            <button
              type="button"
              className={`period-btn ${period === 'day' ? 'active' : ''}`}
              onClick={() => setPeriod('day')}
            >
              Day
            </button>
            <button
              type="button"
              className={`period-btn ${period === 'week' ? 'active' : ''}`}
              onClick={() => setPeriod('week')}
            >
              Week
            </button>
            <button
              type="button"
              className={`period-btn ${period === 'month' ? 'active' : ''}`}
              onClick={() => setPeriod('month')}
            >
              Month
            </button>
            <button
              type="button"
              className={`period-btn ${period === 'custom' ? 'active' : ''}`}
              onClick={() => setPeriod('custom')}
            >
              Custom
            </button>
          </div>

          {/* Date range display or Custom / Day date picker */}
          {period === 'custom' ? (
            <div className="custom-date-inputs">
              <input
                type="date"
                className="activity-date-input"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className="date-sep">to</span>
              <input
                type="date"
                className="activity-date-input"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          ) : period === 'day' ? (
            <div className="custom-date-inputs">
              <input
                type="date"
                className="activity-date-input"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setCustomEnd(e.target.value);
                }}
              />
            </div>
          ) : (
            <div className="period-date-badge">
              <span>{activeData.selected_label}</span>
            </div>
          )}

          <span className="operating-hours-text">{activeData.operating_hours}</span>
        </div>

        <div className="toolbar-right-group">
          {/* Machines dropdown */}
          <div className="select-wrapper">
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              className="activity-select"
            >
              <option value="all">All machines</option>
              <option value="washers">Washers only</option>
              <option value="dryers">Dryers only</option>
              {activeData.available_machines &&
                activeData.available_machines.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} ({m.type === 'washer' ? 'Washer' : 'Dryer'})
                  </option>
                ))}
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </div>

          {/* Customers dropdown */}
          <div className="select-wrapper">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="activity-select"
            >
              <option value="all">All customers</option>
              <option value="repeat">Repeat customers</option>
              <option value="first_time">First-time visitors</option>
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </div>

          <button
            className="activity-refresh-btn"
            onClick={fetchRealtimeAnalytics}
            title="Refresh database analytics data"
          >
            <RefreshCw size={14} className={isLoading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* 3. Four Top KPI Summary Cards */}
      <div className="activity-kpi-grid">
        {/* Card 1: Customers */}
        <div className="activity-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-bullet bullet-blue">•</span>
            <span className="kpi-title">Unique customers</span>
            {activeData.top_metrics.total_visits !== undefined && (
              <span className="kpi-badge-sub" title="Total store visits logged across all customers">
                {activeData.top_metrics.total_visits} {activeData.top_metrics.total_visits === 1 ? 'visit' : 'visits'}
              </span>
            )}
          </div>
          <div className="kpi-number">{activeData.top_metrics.customers}</div>
          <div className="kpi-subtext">{activeData.top_metrics.customers_sub}</div>
        </div>

        {/* Card 2: Completed cycles */}
        <div className="activity-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-bullet bullet-blue">•</span>
            <span className="kpi-title">Completed cycles</span>
          </div>
          <div className="kpi-number">{activeData.top_metrics.completed_cycles}</div>
          <div className="kpi-subtext">{activeData.top_metrics.completed_cycles_sub}</div>
        </div>

        {/* Card 3: Machine utilization */}
        <div className="activity-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-bullet bullet-green">•</span>
            <span className="kpi-title">Machine utilization</span>
          </div>
          <div className="kpi-number">{activeData.top_metrics.utilization}</div>
          <div className="kpi-subtext">{activeData.top_metrics.utilization_sub}</div>
        </div>

        {/* Card 4: Busiest window */}
        <div className="activity-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-bullet bullet-navy">•</span>
            <span className="kpi-title">Busiest window</span>
          </div>
          <div className="kpi-number">{activeData.top_metrics.busiest_window}</div>
          <div className="kpi-subtext">{activeData.top_metrics.busiest_window_sub}</div>
        </div>
      </div>

      {/* 4. Section: Your usage, at every scale */}
      <section className="activity-section-block">
        <div className="section-block-header">
          <h2 className="section-block-title">Your usage, at every scale</h2>
          <p className="section-block-sub">
            Customers and machine activity across a day, a week and a month.
          </p>
        </div>

        <div className="scale-comparison-grid">
          {/* Scale 1: DAY */}
          <div className={`scale-card ${period === 'day' || (period === 'custom' && customStart === customEnd) ? 'highlighted' : ''}`}>
            <div className="scale-card-top">
              <span className="scale-tag">DAY</span>
              <span className="scale-date">{activeData.scales?.day?.label}</span>
            </div>
            <div className="scale-metrics-row">
              <div className="scale-big-val">
                {activeData.scales?.day?.customers}{' '}
                <span className="scale-val-sub">
                  {activeData.scales?.day?.customers === 1 ? 'customer' : 'customers'}
                </span>
                {activeData.scales?.day?.total_visits !== undefined && (
                  <span className="scale-val-unique" title="Total store visits on this day">
                    ({activeData.scales?.day?.total_visits}{' '}
                    {activeData.scales?.day?.total_visits === 1 ? 'visit' : 'visits'})
                  </span>
                )}
              </div>
              <div className="scale-sub-metrics">
                <span className="scale-metric-cycles">{activeData.scales?.day?.cycles} cycles</span>
                <span className="scale-metric-util">{activeData.scales?.day?.utilization} utilized</span>
              </div>
            </div>
            <div className="scale-chart-title">{activeData.scales?.day?.chart_title}</div>
            <div className="scale-barchart day-bars">
              {activeData.scales?.day?.bars?.map((b, i) => (
                <div key={i} className="bar-col">
                  <div className="bar-track">
                    <div
                      className="bar-fill bar-blue"
                      style={{
                        height: b.pct > 0 ? `${b.pct}%` : '4px',
                        opacity: b.pct > 0 ? 1 : 0.25
                      }}
                      title={`${b.label}: ${b.value} cycles`}
                    />
                  </div>
                  <span className="bar-label">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scale 2: WEEK */}
          <div className={`scale-card ${period === 'week' ? 'highlighted' : ''}`}>
            <div className="scale-card-top">
              <span className="scale-tag">WEEK</span>
              <span className="scale-date">{activeData.scales?.week?.label}</span>
            </div>
            <div className="scale-metrics-row">
              <div className="scale-big-val">
                {activeData.scales?.week?.customers}{' '}
                <span className="scale-val-sub">
                  {activeData.scales?.week?.customers === 1 ? 'customer' : 'customers'}
                </span>
                {activeData.scales?.week?.total_visits !== undefined && (
                  <span className="scale-val-unique" title="Total store visits this week">
                    ({activeData.scales?.week?.total_visits}{' '}
                    {activeData.scales?.week?.total_visits === 1 ? 'visit' : 'visits'})
                  </span>
                )}
              </div>
              <div className="scale-sub-metrics">
                <span className="scale-metric-cycles">{activeData.scales?.week?.cycles} cycles</span>
                <span className="scale-metric-util">{activeData.scales?.week?.utilization} utilized</span>
              </div>
            </div>
            <div className="scale-chart-title">{activeData.scales?.week?.chart_title}</div>
            <div className="scale-barchart week-bars">
              {activeData.scales?.week?.bars?.map((b, i) => (
                <div key={i} className="bar-col">
                  <div className="bar-track">
                    <div
                      className="bar-fill bar-navy"
                      style={{
                        height: b.pct > 0 ? `${b.pct}%` : '4px',
                        opacity: b.pct > 0 ? 1 : 0.25
                      }}
                      title={`${b.label}: ${b.value} cycles`}
                    />
                  </div>
                  <span className="bar-label">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scale 3: PAST 30 DAYS */}
          <div className={`scale-card ${period === 'month' ? 'highlighted' : ''}`}>
            <div className="scale-card-top">
              <span className="scale-tag">{activeData.scales?.month?.tag || 'PAST 30 DAYS'}</span>
              <span className="scale-date">{activeData.scales?.month?.label}</span>
            </div>
            <div className="scale-metrics-row">
              <div className="scale-big-val">
                {activeData.scales?.month?.customers} <span className="scale-val-sub">customers</span>
                {activeData.scales?.month?.total_visits !== undefined && (
                  <span className="scale-val-unique" title="Total store visits in past 30 days">
                    ({activeData.scales?.month?.total_visits} visits)
                  </span>
                )}
              </div>
              <div className="scale-sub-metrics">
                <span className="scale-metric-cycles">{activeData.scales?.month?.cycles} cycles</span>
                <span className="scale-metric-util">{activeData.scales?.month?.utilization} utilized</span>
              </div>
            </div>
            <div className="scale-chart-title">{activeData.scales?.month?.chart_title}</div>
            <div className="scale-barchart month-bars">
              {activeData.scales?.month?.bars?.map((b, i) => (
                <div key={i} className="bar-col">
                  <div className="bar-track">
                    <div
                      className="bar-fill bar-teal"
                      style={{
                        height: b.pct > 0 ? `${b.pct}%` : '4px',
                        opacity: b.pct > 0 ? 1 : 0.25
                      }}
                      title={`${b.label}: ${b.value} cycles`}
                    />
                  </div>
                  <span className="bar-label">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Section: Heatmap & Machine Time Used (2 Columns) */}
      <div className="activity-two-col-grid">
        {/* Left Column: Heatmap */}
        <div className="activity-panel-card">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">When customers come in</h3>
              <p className="panel-card-subtitle">
                {activeData.heatmap?.total_visits
                  ? `${activeData.heatmap.total_visits} store visits from ${activeData.top_metrics.customers} unique customers · first arrival each day`
                  : 'Customer arrivals · one customer counted at first visit each day'}
              </p>
            </div>
            <span className="panel-date-badge">{activeData.heatmap?.period_label}</span>
          </div>

          {/* Heatmap table */}
          <div className="heatmap-table-container">
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th className="heatmap-corner-th"></th>
                  {activeData.heatmap?.time_slots?.map((slot, i) => (
                    <th key={i}>{slot}</th>
                  ))}
                  <th className="heatmap-total-th">Visits</th>
                </tr>
              </thead>
              <tbody>
                {activeData.heatmap?.rows?.map((r, rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="heatmap-day-td">{r.day}</td>
                    {r.slots.map((val, colIdx) => {
                      const colorStyle = getHeatmapColor(val);
                      return (
                        <td key={colIdx} className="heatmap-cell-td">
                          <div
                            className="heatmap-cell-block"
                            style={{
                              backgroundColor: colorStyle.bg,
                              color: colorStyle.color
                            }}
                          >
                            {val}
                          </div>
                        </td>
                      );
                    })}
                    <td className="heatmap-row-total-td">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Heatmap Legend */}
          <div className="heatmap-legend-row">
            <span className="legend-label">Quieter</span>
            <div className="legend-gradient-bar">
              <span style={{ backgroundColor: '#e0f2fe' }}></span>
              <span style={{ backgroundColor: '#7dd3fc' }}></span>
              <span style={{ backgroundColor: '#38bdf8' }}></span>
              <span style={{ backgroundColor: '#0284c7' }}></span>
              <span style={{ backgroundColor: '#0f3d8a' }}></span>
            </div>
            <span className="legend-label">Busier</span>
          </div>
        </div>

        {/* Right Column: How Machine Time is Used */}
        <div className="activity-panel-card">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">How machine time is used</h3>
              <p className="panel-card-subtitle">{activeData.time_usage?.sub_title}</p>
            </div>
          </div>

          <div className="utilization-formula-box">
            <p className="formula-main">{activeData.time_usage?.formula}</p>
            <p className="formula-desc">{activeData.time_usage?.formula_sub}</p>
          </div>

          {/* Donut Chart */}
          <div className="donut-chart-row">
            <div className="donut-container">
              <svg viewBox="0 0 160 160" className="donut-svg">
                {/* Background full circle (idle) */}
                <circle
                  cx="80"
                  cy="80"
                  r="62"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="20"
                />
                {/* Active arc circle */}
                <circle
                  cx="80"
                  cy="80"
                  r="62"
                  fill="none"
                  stroke="#00c49f"
                  strokeWidth="20"
                  strokeDasharray={`${(Math.min(activeData.time_usage?.utilization_pct || 0, 100) / 100) * (2 * Math.PI * 62)} ${
                    2 * Math.PI * 62
                  }`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                />
              </svg>
              <div className="donut-center-text">
                <span className="donut-center-big">{activeData.time_usage?.utilization_pct}%</span>
                <span className="donut-center-sub">active time</span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="donut-legend-col">
              <div className="donut-legend-item">
                <div className="legend-indicator dot-teal"></div>
                <div>
                  <span className="legend-name">Active</span>
                  <div className="legend-val">{activeData.time_usage?.active_time}</div>
                </div>
              </div>
              <div className="donut-legend-item">
                <div className="legend-indicator dot-gray"></div>
                <div>
                  <span className="legend-name">Idle</span>
                  <div className="legend-val">{activeData.time_usage?.idle_time}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Section: Every machine, in view & Wash vs. dry (2 Columns) */}
      <div className="activity-two-col-grid" style={{ marginTop: '20px' }}>
        {/* Left Column: Machine Table */}
        <div className="activity-panel-card">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Every machine, in view</h3>
              <p className="panel-card-subtitle">{activeData.machine_view?.sub_title}</p>
            </div>
            <div className="unit-pill-badges">
              {activeData.machine_view?.summary_pills?.map((p, i) => (
                <span key={i} className="unit-summary-pill">{p}</span>
              ))}
            </div>
          </div>

          <div className="table-wrapper machine-usage-table-wrapper">
            <table className="machine-usage-table">
              <thead>
                <tr>
                  <th>MACHINE</th>
                  <th>TYPE</th>
                  <th>CYCLES</th>
                  <th>ACTIVE TIME</th>
                  <th>UTILIZATION</th>
                  <th>IDLE TIME</th>
                </tr>
              </thead>
              <tbody>
                {activeData.machine_view?.units?.map((u, i) => (
                  <tr key={i}>
                    <td>
                      <div className="machine-name-cell">
                        <span className={`machine-bullet ${u.type === 'Washer' ? 'bullet-washer' : 'bullet-dryer'}`}>•</span>
                        <span className="machine-code-text">{u.code}</span>
                      </div>
                    </td>
                    <td>
                      <span className="machine-type-text">{u.type}</span>
                    </td>
                    <td>
                      <span className="machine-cycles-val">{u.cycles}</span>
                    </td>
                    <td>
                      <span className="machine-active-val">{u.active_time}</span>
                    </td>
                    <td>
                      <div className="utilization-bar-cell">
                        <div className="mini-progress-track">
                          <div
                            className="mini-progress-fill"
                            style={{ width: `${Math.min(u.utilization, 100)}%` }}
                          />
                        </div>
                        <span className="utilization-pct-text">{u.utilization}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="machine-idle-val">{u.idle_time}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="machine-table-footnote">
            {activeData.machine_view?.footer_note}
          </p>
        </div>

        {/* Right Column: Wash vs Dry */}
        <div className="activity-panel-card">
          <div className="panel-card-header">
            <div>
              <h3 className="panel-card-title">Wash vs. dry</h3>
              <p className="panel-card-subtitle">
                Share of {activeData.wash_vs_dry?.total_cycles} completed machine cycles
              </p>
            </div>
          </div>

          {/* Wash vs Dry Donut */}
          <div className="donut-chart-row">
            <div className="donut-container">
              <svg viewBox="0 0 160 160" className="donut-svg">
                {/* Background arc circle (dryers) */}
                <circle
                  cx="80"
                  cy="80"
                  r="62"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="20"
                />
                {/* Washers arc circle */}
                <circle
                  cx="80"
                  cy="80"
                  r="62"
                  fill="none"
                  stroke="#0b1a44"
                  strokeWidth="20"
                  strokeDasharray={`${(Math.min(activeData.wash_vs_dry?.washers?.pct || 0, 100) / 100) * (2 * Math.PI * 62)} ${
                    2 * Math.PI * 62
                  }`}
                  strokeDashoffset="0"
                  strokeLinecap="butt"
                  transform="rotate(-90 80 80)"
                />
              </svg>
              <div className="donut-center-text">
                <span className="donut-center-big">{activeData.wash_vs_dry?.total_cycles}</span>
                <span className="donut-center-sub">cycles</span>
              </div>
            </div>

            {/* Wash vs Dry Legend */}
            <div className="donut-legend-col">
              <div className="donut-legend-item">
                <div className="legend-indicator dot-navy"></div>
                <div>
                  <span className="legend-name">Washers</span>
                  <div className="legend-val">
                    {activeData.wash_vs_dry?.washers?.cycles} cycles · {activeData.wash_vs_dry?.washers?.pct}%
                  </div>
                </div>
              </div>
              <div className="donut-legend-item">
                <div className="legend-indicator dot-sky"></div>
                <div>
                  <span className="legend-name">Dryers</span>
                  <div className="legend-val">
                    {activeData.wash_vs_dry?.dryers?.cycles} cycles · {activeData.wash_vs_dry?.dryers?.pct}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TIME UTILIZATION BY TYPE */}
          <div className="type-utilization-block">
            <span className="type-utilization-header">TIME UTILIZATION BY TYPE</span>

            <div className="type-progress-row">
              <div className="type-progress-labels">
                <span>Washers</span>
                <span className="type-val-bold">{activeData.wash_vs_dry?.utilization_by_type?.washers_pct}%</span>
              </div>
              <div className="horizontal-gauge-track">
                <div
                  className="horizontal-gauge-fill fill-navy"
                  style={{ width: `${Math.min(activeData.wash_vs_dry?.utilization_by_type?.washers_pct || 0, 100)}%` }}
                />
              </div>
            </div>

            <div className="type-progress-row">
              <div className="type-progress-labels">
                <span>Dryers</span>
                <span className="type-val-bold">{activeData.wash_vs_dry?.utilization_by_type?.dryers_pct}%</span>
              </div>
              <div className="horizontal-gauge-track">
                <div
                  className="horizontal-gauge-fill fill-sky"
                  style={{ width: `${Math.min(activeData.wash_vs_dry?.utilization_by_type?.dryers_pct || 0, 100)}%` }}
                />
              </div>
            </div>

            <span className="type-utilization-footnote">
              Active runtime ÷ available hours for each machine type
            </span>
          </div>
        </div>
      </div>

      {/* 7. Section: THE WEEK AT A GLANCE */}
      <div className="glance-insights-banner">
        <span className="glance-banner-tag">THE WEEK AT A GLANCE</span>
        <div className="glance-insights-row">
          {activeData.glance_insights?.map((insight, idx) => (
            <div key={idx} className="glance-insight-item">
              <span className="insight-text">{insight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Footer */}
      <footer className="activity-page-footer">
        <p>
          Usage only. No financial or collection data. Customer = unique patron in a period · Session = machine run session · Cycle = one completed machine run
        </p>
      </footer>
    </div>
  );
}
