import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export const NotFound = () => {
  return (
    <div
      style={{
        maxWidth: '640px',
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
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
        }}
      >
        <AlertTriangle size={32} color="#f59e0b" />
      </div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>404 &mdash; Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>
        The requested clinical telemetry view or route does not exist.
      </p>
      <div style={{ marginTop: '24px' }}>
        <Link
          to="/dashboard"
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} /> Return to Ward Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
