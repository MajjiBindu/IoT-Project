import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { AlertBanner } from '../components/AlertBanner';
import { sseClient } from '../services/sseClient';
import { AlertTriangle } from 'lucide-react';

export const RootLayout = () => {
  useEffect(() => {
    // Initiate Server-Sent Events listener at root application lifecycle
    sseClient.connect();
    return () => {
      sseClient.disconnect();
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Global Real-time Fall Alert Banner */}
      <AlertBanner />

      {/* Navigation Header */}
      <Navbar />

      {/* Required Prototype & Clinical Disclaimer Header */}
      <section
        style={{
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12), rgba(14, 165, 233, 0.08))',
          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '12px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(245, 158, 11, 0.25)',
                    color: '#fbbf24',
                  }}
                >
                  Software Prototype
                </span>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Hospital Mobility Monitoring
                </strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                <strong>Notice:</strong> This application is a software prototype for evaluation and research.
                Kinematic telemetry and rapid fall detection algorithms are <strong>simulated</strong> and are{' '}
                <strong>not clinically validated</strong> for diagnostic, life-critical, or unsupervised healthcare use.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface-elevated)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Env: Development / Simulated
            </span>
          </div>
        </div>
      </section>

      {/* Main Routed Content Area */}
      <main style={{ flex: 1, paddingBottom: '40px' }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '20px 24px',
          background: 'rgba(10, 15, 29, 0.6)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <strong>Hospital Mobility Monitoring</strong> &mdash; Inpatient Mobility Telemetry &amp; Simulated Fall Safeguard Prototype.
          </div>
          <div>
            Fall detection is simulated &bull; Not clinically validated for diagnostic use
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RootLayout;
