import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ShieldAlert,
  Radio,
  User,
  History,
  Sliders,
  Cpu,
  MapPin,
  Shield,
  LogOut,
} from 'lucide-react';
import { sseClient } from '../services/sseClient';
import { AudioAlertController } from './AudioAlertController';
import { useAlerts } from '../context/AlertContext';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const [sseStatus, setSseStatus] = useState('DISCONNECTED');
  const { activeAlerts, error: alertError } = useAlerts();
  const { error: patientError } = usePatients();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const dbError = alertError || patientError;

  useEffect(() => {
    return sseClient.onStatusChange((status) => {
      setSseStatus(status);
    });
  }, []);

  const criticalCount = activeAlerts.filter((a) => a.severity === 'CRITICAL').length;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Base navigation tabs for all clinical staff (ADMIN and NURSE)
  const baseTabs = [
    { path: '/dashboard', label: 'Ward Dashboard', icon: Activity },
    { path: '/alerts', label: 'Alert Center', icon: ShieldAlert, badge: activeAlerts.length },
    { path: '/live-tracking', label: 'Live Telemetry', icon: Radio },
    { path: '/movement-history', label: 'Movement History', icon: History },
    { path: '/patients', label: 'Patient Roster', icon: User },
    { path: '/locations', label: 'Locations', icon: MapPin },
    { path: '/devices', label: 'Devices', icon: Cpu },
  ];

  // Admin-only navigation items
  const adminTabs = [
    { path: '/staff', label: 'Staff Management', icon: Shield },
    { path: '/simulator', label: 'Simulator', icon: Sliders },
  ];

  const visibleTabs = isAdmin ? [...baseTabs, ...adminTabs] : baseTabs;

  return (
    <header
      style={{
        background: 'rgba(10, 15, 29, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 800,
        padding: '0 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '68px',
          maxWidth: '1440px',
          margin: '0 auto',
          gap: '16px',
        }}
      >
        {/* Brand & Ward Identity */}
        <Link
          to="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            textDecoration: 'none',
            color: 'inherit',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(14, 165, 233, 0.4)',
            }}
          >
            <Activity size={22} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Hospital Mobility Monitor
              </h1>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(14, 165, 233, 0.15)',
                  color: 'var(--color-brand)',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                }}
              >
                WARD 3B
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Real-time Ingestion &amp; Automated Fall Safeguard
            </p>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: isActive ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid transparent',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'var(--transition-smooth)',
                  whiteSpace: 'nowrap',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} color={isActive ? '#0ea5e9' : 'currentColor'} />
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span
                        style={{
                          background: criticalCount > 0 ? '#ef4444' : '#f59e0b',
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Right Status & Auth Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Database Connectivity Indicator if degraded */}
          {dbError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#f87171',
              }}
              title={`Database status: ${dbError}`}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <span>DB Error</span>
            </div>
          )}

          {/* SSE Stream Status Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor:
                  sseStatus === 'CONNECTED'
                    ? '#10b981'
                    : sseStatus === 'CONNECTING'
                    ? '#f59e0b'
                    : '#ef4444',
              }}
              className={sseStatus === 'CONNECTED' ? 'animate-pulse-emerald' : ''}
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              {sseStatus === 'CONNECTED'
                ? 'Live'
                : sseStatus === 'CONNECTING'
                ? 'Connecting...'
                : 'Offline'}
            </span>
          </div>

          {/* Audio Chime Controller */}
          <AudioAlertController />

          {/* Authenticated Staff Identity & Logout */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 10px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.2 }}>
                    {user.fullName}
                  </div>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: isAdmin ? '#38bdf8' : '#34d399',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {user.role}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '6px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                }}
                title="Sign out of station"
              >
                <LogOut size={13} color="#f87171" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
