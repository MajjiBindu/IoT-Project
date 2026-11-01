import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, RefreshCw, ArrowLeft } from 'lucide-react';

export const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: 'var(--text-muted)',
        }}
      >
        <RefreshCw size={32} className="animate-spin" color="var(--color-brand)" />
        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Verifying hospital staff credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div
        style={{
          maxWidth: '560px',
          margin: '60px auto',
          padding: '36px',
          textAlign: 'center',
        }}
        className="glass-panel"
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-full)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px auto',
          }}
        >
          <ShieldAlert size={28} color="#ef4444" />
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '8px' }}>
          Access Restricted
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          This administrative resource requires <strong>{requiredRole}</strong> privileges. Your current role is{' '}
          <strong style={{ color: 'var(--color-brand)' }}>{user?.role}</strong>.
        </p>
        <Link
          to="/dashboard"
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={14} />
          <span>Return to Ward Dashboard</span>
        </Link>
      </div>
    );
  }

  return children;
};
