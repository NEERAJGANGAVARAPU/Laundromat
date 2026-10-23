import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import CustomerView from './components/CustomerView';
import OwnerLogin from './components/OwnerLogin';
import OwnerDashboard from './components/OwnerDashboard';

// Protected Route wrapper for Owner Dashboard
function ProtectedOwnerRoute({ children }) {
  const isAuth = Boolean(localStorage.getItem('spin_owner_auth'));
  return isAuth ? children : <Navigate to="/owner/login" replace />;
}

// SMART ROOT ROUTE:
// - If the user scanned a QR code (has ?machine=W-1), open the Customer Wash View!
// - If visiting on desktop/browser directly without a QR code, open the Owner Portal!
function SmartRootRoute() {
  const [searchParams] = useSearchParams();
  const hasMachineParam = Boolean(searchParams.get('machine'));

  if (hasMachineParam) {
    return <CustomerView />;
  }

  // Not a QR scan -> default to Owner Portal
  return <Navigate to="/owner/login" replace />;
}

// Owner Login Route wrapper
function OwnerLoginRoute() {
  const isAuth = Boolean(localStorage.getItem('spin_owner_auth'));
  return isAuth ? <Navigate to="/owner/dashboard" replace /> : <OwnerLogin />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Smart Entry Point */}
        <Route path="/" element={<SmartRootRoute />} />

        {/* Dedicated Customer Route */}
        <Route path="/wash" element={<CustomerView />} />

        {/* Owner Login */}
        <Route path="/owner/login" element={<OwnerLoginRoute />} />

        {/* Owner Dashboard */}
        <Route
          path="/owner"
          element={<Navigate to="/owner/dashboard" replace />}
        />
        <Route
          path="/owner/dashboard"
          element={
            <ProtectedOwnerRoute>
              <OwnerDashboard />
            </ProtectedOwnerRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
