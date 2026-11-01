import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { StatusBadge } from '../../components/StatusBadge';

export const MovementHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHistory = () => {
    setLoading(true);
    apiClient
      .getTelemetryHistory(null, 50)
      .then((res) => {
        if (res && res.success) {
          setHistory(res.data);
          setError(null);
        } else {
          setError(res?.message || 'Failed to load telemetry history');
        }
      })
      .catch((err) => {
        console.warn('[History] Could not load telemetry history:', err);
        setError(err.message || 'Network error or database unavailable');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <History color="#0ea5e9" size={26} />
          Movement &amp; Telemetry History
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Historical sensor recordings of simulated patient kinematics, orientation angles, and gait classifications.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
        {error ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#f87171' }}>
            <p style={{ fontWeight: 600 }}>Database Unavailable</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {error}
            </p>
            <button onClick={loadHistory} className="btn btn-sm btn-primary" style={{ marginTop: '14px' }}>
              Retry Loading
            </button>
          </div>
        ) : loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading movement history...
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No recorded history packets yet. Trigger actions from the Dashboard or Simulation Controls.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px' }}>Timestamp</th>
                <th style={{ padding: '10px' }}>Device ID</th>
                <th style={{ padding: '10px' }}>Movement State</th>
                <th style={{ padding: '10px' }}>Accel (G)</th>
                <th style={{ padding: '10px' }}>Pitch / Roll</th>
                <th style={{ padding: '10px' }}>Alert Generated</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, idx) => (
                <tr key={item._id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '--'}
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>{item.deviceId}</td>
                  <td style={{ padding: '10px' }}>
                    <StatusBadge status={item.movementState} type="movement" />
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>
                    {item.metrics?.accelMagnitude?.toFixed(2) || '--'} G
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {item.metrics?.pitch?.toFixed(1) || '--'}° / {item.metrics?.roll?.toFixed(1) || '--'}°
                  </td>
                  <td style={{ padding: '10px' }}>
                    {item.alertGenerated ? (
                      <span className="badge badge-critical">FALL IMPACT</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export const MovementHistoryView = MovementHistory;
export default MovementHistory;
