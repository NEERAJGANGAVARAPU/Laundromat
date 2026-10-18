import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CustomerView from './components/CustomerView';
import OwnerLogin from './components/OwnerLogin';
import OwnerDashboard from './components/OwnerDashboard';

// Protected Route wrapper for Owner Dashboard
function ProtectedOwnerRoute({ children }) {
  const isAuth = Boolean(localStorage.getItem('spin_owner_auth'));
  return isAuth ? children : <Navigate to="/owner/login" replace />;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem('spin_owner_auth'));
  });

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Customer Portal (Default /) */}
        <Route path="/" element={<CustomerView />} />
        <Route path="/wash" element={<CustomerView />} />

        {/* Owner Login */}
        <Route
          path="/owner/login"
          element={
            isAuthenticated ? (
              <Navigate to="/owner/dashboard" replace />
            ) : (
              <OwnerLogin onLogin={handleLogin} />
            )
          }
        />

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
