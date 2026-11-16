import React from 'react';

/**
 * Base Shimmer Skeleton Block
 */
export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius = '8px',
  className = '',
  style = {}
}) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Text Lines Skeleton
 */
export function SkeletonText({
  lines = 2,
  width = '100%',
  height = '13px',
  gap = '8px',
  className = ''
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, width: '100%' }} className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={height}
          width={i === lines - 1 && lines > 1 ? '70%' : width}
          borderRadius="6px"
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for Owner Dashboard 4 Top KPI Cards
 */
export function SkeletonKPIGrid({ count = 4 }) {
  return (
    <div className="kpi-grid" aria-busy="true" aria-label="Loading metrics">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card skeleton-card">
          <div className="kpi-avail-top" style={{ marginBottom: '12px' }}>
            <Skeleton width="90px" height="14px" borderRadius="6px" />
            <Skeleton width="48px" height="20px" borderRadius="12px" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
            <Skeleton width="60px" height="34px" borderRadius="8px" />
            <Skeleton width="80px" height="16px" borderRadius="6px" />
          </div>
          <Skeleton width="100%" height="8px" borderRadius="4px" style={{ marginBottom: '12px' }} />
          <Skeleton width="130px" height="12px" borderRadius="4px" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Machine Floor Grid (Washers & Dryers)
 */
export function SkeletonMachineGrid({ count = 8 }) {
  return (
    <div className="machine-cards-grid" aria-busy="true" aria-label="Loading machines">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="machine-floor-card skeleton-card">
          {/* Card Top: Code badge + status chip */}
          <div className="floor-card-top" style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Skeleton width="32px" height="32px" borderRadius="8px" />
              <Skeleton width="55px" height="20px" borderRadius="6px" />
            </div>
            <Skeleton width="68px" height="22px" borderRadius="12px" />
          </div>

          {/* Card Body: Heading & subtitle */}
          <div className="floor-card-body" style={{ marginBottom: '16px' }}>
            <Skeleton width="75%" height="20px" borderRadius="6px" style={{ marginBottom: '8px' }} />
            <Skeleton width="50%" height="13px" borderRadius="4px" />
          </div>

          {/* Card Actions Footer */}
          <div className="floor-card-actions">
            <Skeleton width="100%" height="34px" borderRadius="8px" style={{ marginBottom: '8px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Skeleton width="50%" height="30px" borderRadius="8px" />
              <Skeleton width="50%" height="30px" borderRadius="8px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Customer Sessions Table (Table rows)
 */
export function SkeletonTableRows({ rows = 5, columns = 7 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="skeleton-row" aria-busy="true">
          {/* 1. Customer Avatar + Name */}
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Skeleton width="32px" height="32px" borderRadius="50%" />
              <Skeleton width="100px" height="15px" borderRadius="4px" />
            </div>
          </td>
          {/* 2. Contact Details */}
          <td>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Skeleton width="130px" height="13px" borderRadius="4px" />
              <Skeleton width="90px" height="11px" borderRadius="4px" />
            </div>
          </td>
          {/* 3. Machine Tag */}
          <td>
            <Skeleton width="48px" height="22px" borderRadius="6px" />
          </td>
          {/* 4. Service */}
          <td>
            <Skeleton width="60px" height="14px" borderRadius="4px" />
          </td>
          {/* 5. Status Chip */}
          <td>
            <Skeleton width="80px" height="22px" borderRadius="12px" />
          </td>
          {/* 6. Email notification badge */}
          <td>
            <Skeleton width="65px" height="20px" borderRadius="10px" />
          </td>
          {/* 7. Details / Action button */}
          <td>
            <Skeleton width="55px" height="26px" borderRadius="6px" />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Skeleton for Reports Tab Summary KPI Cards
 */
export function SkeletonReportKPIGrid({ count = 4 }) {
  return (
    <div className="reports-kpi-grid" aria-busy="true" aria-label="Loading reports data">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="report-card skeleton-card">
          <Skeleton width="110px" height="13px" borderRadius="4px" style={{ marginBottom: '12px' }} />
          <Skeleton width="70px" height="34px" borderRadius="8px" style={{ marginBottom: '10px' }} />
          <Skeleton width="130px" height="12px" borderRadius="4px" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for Customer Mobile View (QR code scan / initial load)
 */
export function SkeletonCustomerView() {
  return (
    <div className="content-step skeleton-customer-step" aria-busy="true" aria-label="Loading machine session">
      {/* Step Tracker Indicator Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '22px' }}>
        <Skeleton width="70px" height="8px" borderRadius="4px" />
        <Skeleton width="70px" height="8px" borderRadius="4px" />
        <Skeleton width="70px" height="8px" borderRadius="4px" />
      </div>

      {/* Machine Highlight Hero Card Skeleton */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.72)',
          border: '1.5px solid rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 8px 24px -4px rgba(11, 26, 68, 0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Skeleton width="40px" height="40px" borderRadius="12px" />
            <div>
              <Skeleton width="70px" height="18px" borderRadius="6px" style={{ marginBottom: '5px' }} />
              <Skeleton width="90px" height="12px" borderRadius="4px" />
            </div>
          </div>
          <Skeleton width="74px" height="24px" borderRadius="12px" />
        </div>
        <Skeleton width="100%" height="38px" borderRadius="10px" />
      </div>

      {/* Form Fields Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
        <div>
          <Skeleton width="100px" height="13px" borderRadius="4px" style={{ marginBottom: '6px' }} />
          <Skeleton width="100%" height="46px" borderRadius="12px" />
        </div>
        <div>
          <Skeleton width="120px" height="13px" borderRadius="4px" style={{ marginBottom: '6px' }} />
          <Skeleton width="100%" height="46px" borderRadius="12px" />
        </div>
        <div>
          <Skeleton width="110px" height="13px" borderRadius="4px" style={{ marginBottom: '6px' }} />
          <Skeleton width="100%" height="46px" borderRadius="12px" />
        </div>
      </div>

      {/* Submit Button Skeleton */}
      <Skeleton width="100%" height="52px" borderRadius="14px" />
    </div>
  );
}

/**
 * Skeleton for Activity Analytics View
 */
export function SkeletonActivityAnalytics() {
  return (
    <div className="activity-analytics-skeleton" aria-busy="true" aria-label="Loading activity analytics">
      {/* 4 Top KPI Cards Skeleton */}
      <div className="activity-kpi-grid" style={{ marginBottom: '28px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="activity-kpi-card skeleton-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Skeleton width="8px" height="8px" borderRadius="50%" />
              <Skeleton width="110px" height="13px" borderRadius="4px" />
            </div>
            <Skeleton width="60px" height="36px" borderRadius="8px" style={{ marginBottom: '10px' }} />
            <Skeleton width="130px" height="12px" borderRadius="4px" />
          </div>
        ))}
      </div>

      {/* Usage at every scale cards */}
      <div className="scale-comparison-grid" style={{ marginBottom: '28px' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="scale-card skeleton-card" style={{ minHeight: '260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <Skeleton width="48px" height="20px" borderRadius="6px" />
              <Skeleton width="80px" height="14px" borderRadius="4px" />
            </div>
            <Skeleton width="80px" height="32px" borderRadius="6px" style={{ marginBottom: '12px' }} />
            <Skeleton width="100%" height="14px" borderRadius="4px" style={{ marginBottom: '18px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100px' }}>
              {Array.from({ length: 12 }).map((_, j) => (
                <Skeleton
                  key={j}
                  width="100%"
                  height={`${20 + ((j * 17) % 70)}px`}
                  borderRadius="4px 4px 0 0"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
