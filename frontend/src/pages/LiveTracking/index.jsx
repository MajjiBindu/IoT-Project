import React, { useState, useEffect } from 'react';
import {
  Radio,
  Activity,
  Zap,
  Pause,
  Play,
  Trash2,
  Cpu,
  Layers,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { sseClient } from '../../services/sseClient';
import { StatusBadge } from '../../components/StatusBadge';

export const LiveTracking = () => {
  const [events, setEvents] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('ALL');

  useEffect(() => {
    // 1. Listen for Simulated Kinematics Telemetry
    const unsubKinematics = sseClient.on('sensor_event', (eventData, eventId) => {
      if (isPaused) return;
      setEvents((prev) => [
        {
          ...eventData,
          source: 'SIMULATED_KINEMATICS',
          sseEventId: eventId,
          receivedAt: new Date(),
        },
        ...prev.slice(0, 149),
      ]);
    });

    // 2. Listen for Physical Arduino Piezo Telemetry (HIGHEST PRIORITY)
    const unsubPiezo = sseClient.on('piezo_telemetry', (telemetry, eventId) => {
      if (isPaused) return;
      const isMovement = telemetry.event === 'MOVEMENT' && telemetry.status === 'ACTIVE';
      setEvents((prev) => [
        {
          id: `piezo-${Date.now()}-${telemetry.sequenceNumber}`,
          source: 'HARDWARE_PIEZO',
          deviceId: telemetry.deviceId || 'ARDUINO-PIEZO-01',
          sequenceNumber: telemetry.sequenceNumber,
          movementState: isMovement ? 'VIBRATION_DETECTED' : 'QUIESCENT',
          metrics: {
            raw: telemetry.raw,
            baseline: telemetry.baseline,
            deviation: telemetry.deviation,
            threshold: telemetry.threshold,
            movementCount: telemetry.movementCount,
          },
          detection: {
            stageName: isMovement ? 'VIBRATION_ACTIVE' : telemetry.status || 'STATIONARY',
          },
          alertGenerated: telemetry.status === 'SENSOR_CHECK',
          sseEventId: eventId,
          receivedAt: new Date(telemetry.timestamp || Date.now()),
        },
        ...prev.slice(0, 149),
      ]);
    });

    return () => {
      unsubKinematics();
      unsubPiezo();
    };
  }, [isPaused]);

  const filteredEvents = events.filter((evt) => {
    if (sourceFilter === 'HARDWARE_PIEZO' && evt.source !== 'HARDWARE_PIEZO') return false;
    if (sourceFilter === 'SIMULATED_KINEMATICS' && evt.source !== 'SIMULATED_KINEMATICS') return false;
    return true;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio color="#0ea5e9" size={28} />
            Live Telemetry Stream: Hardware &amp; Kinematics
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Real-time SSE event pipeline streaming live Arduino piezoelectric ADC deviation and 5-stage IMU kinematics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          >
            <option value="ALL">All Streams (Hardware + Sim)</option>
            <option value="HARDWARE_PIEZO">Real Hardware (Arduino Piezo)</option>
            <option value="SIMULATED_KINEMATICS">Simulated Kinematics (IMU)</option>
          </select>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`btn btn-sm ${isPaused ? 'btn-primary' : 'btn-secondary'}`}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            {isPaused ? 'Resume Stream' : 'Pause Stream'}
          </button>
          <button onClick={() => setEvents([])} className="btn btn-sm btn-secondary">
            <Trash2 size={14} /> Clear Log
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ padding: '56px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>Awaiting incoming telemetry packets...</p>
            <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              Tap or vibrate physical Arduino piezo discs, or trigger simulation scenarios from the Dashboard or Simulator.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderBottom: '1px solid var(--border-subtle)',
                    textAlign: 'left',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Time</th>
                  <th style={{ padding: '12px 14px' }}>Data Source</th>
                  <th style={{ padding: '12px 14px' }}>Device ID</th>
                  <th style={{ padding: '12px 14px' }}>Sequence</th>
                  <th style={{ padding: '12px 14px' }}>Movement State</th>
                  <th style={{ padding: '12px 14px' }}>Live Metric Readout</th>
                  <th style={{ padding: '12px 14px' }}>Pipeline Stage</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Alert</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((evt, idx) => {
                  const isHardware = evt.source === 'HARDWARE_PIEZO';
                  const isAlert = evt.alertGenerated;

                  return (
                    <tr
                      key={evt.id || idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: isAlert
                          ? 'rgba(239, 68, 68, 0.12)'
                          : isHardware
                          ? 'rgba(16, 185, 129, 0.03)'
                          : 'transparent',
                      }}
                    >
                      {/* Time */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                        {evt.receivedAt ? evt.receivedAt.toLocaleTimeString() : '--'}
                      </td>

                      {/* Source */}
                      <td style={{ padding: '12px 14px' }}>
                        {isHardware ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            <Cpu size={11} /> HW PIEZO
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: 'rgba(14, 165, 233, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(14, 165, 233, 0.3)',
                            }}
                          >
                            <Layers size={11} /> SIM KINEMATICS
                          </span>
                        )}
                      </td>

                      {/* Device ID */}
                      <td style={{ padding: '12px 14px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {evt.deviceId}
                      </td>

                      {/* Sequence */}
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        #{evt.sequenceNumber}
                      </td>

                      {/* Movement State */}
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={evt.movementState} type="movement" />
                      </td>

                      {/* Metric Readout */}
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                        {isHardware ? (
                          <span>
                            ADC: <strong>{evt.metrics?.raw ?? '--'}</strong> | Dev: <strong>{evt.metrics?.deviation ?? '--'}</strong> (Thresh: {evt.metrics?.threshold ?? '--'}) | Cnt: {evt.metrics?.movementCount ?? 0}
                          </span>
                        ) : (
                          <span>
                            Accel:{' '}
                            <strong style={{ color: evt.metrics?.accelMagnitude >= 2.8 ? '#f87171' : evt.metrics?.accelMagnitude <= 0.5 ? '#fbbf24' : 'inherit' }}>
                              {evt.metrics?.accelMagnitude?.toFixed(2)} G
                            </strong>{' '}
                            | Tilt: {evt.metrics?.pitch?.toFixed(1)}° / {evt.metrics?.roll?.toFixed(1)}°
                          </span>
                        )}
                      </td>

                      {/* Pipeline Stage */}
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge
                          status={evt.detection?.stageName || (evt.alertGenerated ? 'FALL_CONFIRMED' : 'IDLE')}
                          type="fallStage"
                        />
                      </td>

                      {/* Alert */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {evt.alertGenerated ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'rgba(239, 68, 68, 0.25)',
                              color: '#f87171',
                            }}
                          >
                            <AlertTriangle size={11} /> CRITICAL
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const LiveTrackingView = LiveTracking;
export default LiveTracking;
