import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, AlertTriangle, Clock, Zap, Activity } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { sseClient } from '../services/sseClient';
import { useAuth } from '../context/AuthContext';

export const ArduinoStatusCard = () => {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [diagnosticWarning, setDiagnosticWarning] = useState(null);
  const { isAdmin } = useAuth();

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getSerialStatus();
      if (res && res.success) {
        setStatusData(res.data);
        if (res.data.lastSensorStatus === 'SENSOR_CHECK') {
          setDiagnosticWarning('Sensor signal check required: Verify probe placement and wiring on analog pin A0.');
        } else {
          setDiagnosticWarning(null);
        }
      }
    } catch (err) {
      console.warn('[ArduinoStatusCard] Could not fetch serial status:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Reconcile status if SSE reconnects after interruption
    const unsubReconnect = sseClient.addReconnectListener(() => {
      console.log('[ArduinoStatusCard] SSE reconnected, refreshing hardware status...');
      fetchStatus();
    });

    // Listen to real-time serial port status changes (connect, disconnect, error)
    const unsubStatus = sseClient.on('serial_status', (data) => {
      setStatusData((prev) => (prev ? { ...prev, ...data } : data));
    });

    // Listen to real-time piezo telemetry packets (DATA records)
    const unsubTelemetry = sseClient.on('piezo_telemetry', (telemetry) => {
      setStatusData((prev) => {
        if (!prev) return prev;

        const isMovement = telemetry.event === 'MOVEMENT' && telemetry.status === 'ACTIVE';
        const isInactive = telemetry.event === 'INACTIVITY' && telemetry.status === 'ACTIVE';

        // Update last movement timestamp ONLY when EVENT === MOVEMENT and STATUS === ACTIVE
        const newMovementDetectedAt = isMovement
          ? (telemetry.timestamp || new Date())
          : (telemetry.lastMovementDetectedAt || prev.lastMovementDetectedAt);

        // Update piezo activity indicator
        const newActivity = isMovement
          ? 'MOVEMENT_DETECTED'
          : isInactive
          ? 'NO_RECENT_MOVEMENT'
          : prev.lastPiezoActivity;

        return {
          ...prev,
          lastReceivedAt: telemetry.timestamp || new Date(),
          lastSequenceNumber: telemetry.sequenceNumber,
          lastMovementCount: telemetry.movementCount !== undefined ? telemetry.movementCount : prev.lastMovementCount,
          lastMovementDetectedAt: newMovementDetectedAt,
          lastPiezoActivity: newActivity,
          lastSensorStatus: telemetry.status,
          stats: {
            ...prev.stats,
            validPackets: (prev.stats?.validPackets || 0) + 1,
          },
        };
      });

      if (telemetry.status === 'SENSOR_CHECK') {
        setDiagnosticWarning('Sensor signal check required: Verify probe placement and wiring on analog pin A0.');
      } else {
        setDiagnosticWarning(null);
      }
    });

    // Listen to diagnostic events
    const unsubDiagnostic = sseClient.on('serial_diagnostic', (diag) => {
      setDiagnosticWarning(diag.message || 'Sensor diagnostic inspection required.');
    });

    return () => {
      unsubReconnect();
      unsubStatus();
      unsubTelemetry();
      unsubDiagnostic();
    };
  }, []);

  const handleReconnect = async () => {
    try {
      setReconnecting(true);
      const res = await apiClient.reconnectSerial();
      if (res && res.success) {
        setStatusData(res.data);
      }
    } catch (err) {
      alert(`Reconnection failed: ${err.message}`);
    } finally {
      setReconnecting(false);
    }
  };

  const isConnected = statusData?.status === 'CONNECTED';
  const isConnecting = statusData?.status === 'CONNECTING';

  return (
    <div
      className="glass-panel"
      style={{
        padding: '18px 22px',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        border: diagnosticWarning
          ? '1.5px solid rgba(245, 158, 11, 0.6)'
          : isConnected
          ? '1px solid rgba(16, 185, 129, 0.3)'
          : '1px solid var(--border-subtle)',
        background: diagnosticWarning
          ? 'rgba(245, 158, 11, 0.05)'
          : 'var(--bg-surface-elevated)',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-sm)',
              background: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Cpu size={18} color={isConnected ? '#10b981' : '#64748b'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                Arduino Hardware Integration
              </h4>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-surface)',
                  color: 'var(--color-brand)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {statusData?.deviceCode || 'ARDUINO-PIEZO-01'}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Piezoelectric vibration sensor assembly (Analog A0 &bull; 9600 baud)
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAdmin && (
            <button
              onClick={handleReconnect}
              disabled={reconnecting}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.75rem', padding: '5px 10px' }}
              title="Trigger USB port reconnect"
            >
              <RefreshCw size={12} className={reconnecting ? 'animate-spin' : ''} />
              {reconnecting ? 'Connecting...' : 'Reconnect USB'}
            </button>
          )}
        </div>
      </div>

      {/* Status Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.8rem',
        }}
      >
        {/* 1. Connection State */}
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>
            Serial Port Status
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isConnected ? '#10b981' : isConnecting ? '#f59e0b' : '#ef4444',
              }}
              className={isConnected ? 'animate-pulse-emerald' : ''}
            />
            <strong style={{ color: isConnected ? '#10b981' : isConnecting ? '#f59e0b' : '#ef4444' }}>
              {statusData?.status || 'DISCONNECTED'}
            </strong>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
              ({statusData?.port || 'COM5'})
            </span>
          </div>
        </div>

        {/* 2. Last Telemetry Packet (Requirement 2: Timestamp, Sequence, Movement Count) */}
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>
            Last Telemetry Packet
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} color="var(--text-muted)" />
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                {statusData?.lastReceivedAt
                  ? new Date(statusData.lastReceivedAt).toLocaleTimeString()
                  : 'Awaiting signal'}
              </span>
              {statusData?.lastSequenceNumber !== null && statusData?.lastSequenceNumber !== undefined && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  (Seq #{statusData.lastSequenceNumber})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Movement Count: <strong style={{ color: 'var(--text-primary)' }}>{statusData?.lastMovementCount ?? 0}</strong>
            </div>
          </div>
        </div>

        {/* 3. Last Movement Detected (Requirement 3: Distinct timestamp and count) */}
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>
            Last Movement Detected
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Zap size={13} color={statusData?.lastMovementDetectedAt ? '#10b981' : 'var(--text-muted)'} />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: statusData?.lastMovementDetectedAt ? '#10b981' : 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                {statusData?.lastMovementDetectedAt
                  ? new Date(statusData.lastMovementDetectedAt).toLocaleTimeString()
                  : 'None recorded yet'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {statusData?.lastPiezoActivity === 'MOVEMENT_DETECTED' ? (
                <span style={{ color: '#10b981', fontWeight: 600 }}>
                  Active vibration detected
                </span>
              ) : statusData?.lastPiezoActivity === 'NO_RECENT_MOVEMENT' ? (
                <span style={{ color: '#f59e0b' }}>
                  No recent movement
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Standby</span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Piezo Sensor Activity Indicator */}
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>
            Piezo Sensor Activity
          </span>
          <div style={{ marginTop: '3px' }}>
            {statusData?.lastPiezoActivity === 'MOVEMENT_DETECTED' ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: '#10b981',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse-emerald" />
                Movement detected by piezo sensor
              </span>
            ) : statusData?.lastPiezoActivity === 'NO_RECENT_MOVEMENT' ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: '#f59e0b',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                No recent movement detected
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Awaiting sensor activity
              </span>
            )}
          </div>
        </div>

        {/* 5. Assigned Patient */}
        <div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>
            Paired Patient
          </span>
          <div style={{ marginTop: '3px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {statusData?.assignedPatient
              ? `${statusData.assignedPatient.name} (Rm ${statusData.assignedPatient.roomNumber})`
              : 'Unassigned (Standby)'}
          </div>
        </div>
      </div>

      {/* SENSOR_CHECK Diagnostic Warning */}
      {diagnosticWarning && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#f59e0b',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>{diagnosticWarning}</span>
        </div>
      )}
    </div>
  );
};
