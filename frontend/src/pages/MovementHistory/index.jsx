import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  RefreshCw,
  Cpu,
  Activity,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { usePatients } from '../../context/PatientContext';
import { StatusBadge } from '../../components/StatusBadge';

export const MovementHistory = () => {
  const { patients } = usePatients();

  // Unified history state
  const [historyItems, setHistoryItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [sourceFilter, setSourceFilter] = useState('ALL'); // ALL, HARDWARE_PIEZO, SIMULATED_KINEMATICS
  const [patientFilter, setPatientFilter] = useState('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(100);

  // Fetch unified history
  const loadUnifiedHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit };
      if (sourceFilter !== 'ALL') params.source = sourceFilter;
      if (patientFilter !== 'ALL') params.patientId = patientFilter;
      if (eventTypeFilter !== 'ALL') params.eventType = eventTypeFilter;

      const res = await apiClient.getUnifiedHistory(params);
      if (res && res.success) {
        setHistoryItems(res.data || []);
        setTotalCount(res.count || res.data?.length || 0);
      } else {
        setError(res?.message || 'Failed to load unified movement history');
      }
    } catch (err) {
      console.warn('[MovementHistory] Fetch error:', err);
      setError(err.message || 'Network error fetching unified movement history');
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, patientFilter, eventTypeFilter, limit]);

  useEffect(() => {
    loadUnifiedHistory();
  }, [loadUnifiedHistory]);

  // Client-side filtering for search query and severity
  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      // Severity filter
      if (severityFilter !== 'ALL') {
        const sev = item.severity || 'INFO';
        if (sev !== severityFilter) return false;
      }

      // Search query (Device, Patient, Event)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = (item.patientId?.name || '').toLowerCase();
        const devId = (item.deviceId || '').toLowerCase();
        const ev = (item.eventType || '').toLowerCase();
        if (!pName.includes(q) && !devId.includes(q) && !ev.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [historyItems, severityFilter, searchQuery]);

  // Export filtered items to CSV
  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;

    const headers = [
      'Timestamp',
      'Data Source',
      'Device ID',
      'Patient Name',
      'Event Type',
      'Severity',
      'Acceleration (G)',
      'Impact Peak (G)',
      'Freefall Duration (ms)',
      'Pitch / Roll (°)',
      'Raw ADC',
      'Baseline',
      'Deviation',
      'Threshold',
      'Movement Count',
    ];

    const rows = filteredItems.map((item) => {
      const isPiezo = item.source === 'HARDWARE_PIEZO' || item.source === 'REAL_HARDWARE';
      return [
        new Date(item.timestamp).toISOString(),
        item.sourceLabel || (isPiezo ? 'Physical Arduino Piezo' : 'Simulated Kinematics'),
        item.deviceId,
        item.patientId?.name || 'Unassigned',
        item.eventType,
        item.severity || 'INFO',
        !isPiezo && item.metrics?.accelMagnitude ? item.metrics.accelMagnitude.toFixed(2) : '',
        !isPiezo && item.impactPeak ? item.impactPeak.toFixed(2) : '',
        !isPiezo && item.freefallDurationMs ? item.freefallDurationMs : '',
        !isPiezo && item.metrics?.pitch !== undefined ? `${item.metrics.pitch}° / ${item.metrics.roll}°` : '',
        isPiezo && item.metrics?.raw !== undefined ? item.metrics.raw : '',
        isPiezo && item.metrics?.baseline !== undefined ? item.metrics.baseline : '',
        isPiezo && item.metrics?.deviation !== undefined ? item.metrics.deviation : '',
        isPiezo && item.metrics?.threshold !== undefined ? item.metrics.threshold : '',
        isPiezo && item.metrics?.movementCount !== undefined ? item.metrics.movementCount : '',
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `movement_history_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History color="#0ea5e9" size={28} />
            Unified Patient Movement &amp; Telemetry History
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Comprehensive chronological audit trail bridging physical Arduino piezoelectric sensors with simulated 5-stage kinematics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadUnifiedHistory}
            className="btn btn-sm btn-secondary"
            title="Reload Telemetry History"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredItems.length === 0}
            className="btn btn-sm btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <Download size={15} /> Export CSV ({filteredItems.length})
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          background: 'var(--bg-surface-elevated)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '200px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search by device, patient, or event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: 'var(--text-primary)',
                fontSize: '0.83rem',
              }}
            />
            {searchQuery && (
              <X
                size={14}
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              />
            )}
          </div>

          {/* Data Source Filter (Crucial Feature requirement) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="ALL">All Sources (Hardware + Sim)</option>
              <option value="HARDWARE_PIEZO">Real Hardware (Arduino Piezo)</option>
              <option value="SIMULATED_KINEMATICS">Simulated Kinematics (IMU)</option>
            </select>
          </div>

          {/* Patient Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Patient:</span>
            <select
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="ALL">All Patients</option>
              {patients.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} (Rm {p.roomNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Event Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Event:</span>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="ALL">All Event Types</option>
              <option value="WALKING">Walking / Movement</option>
              <option value="STATIONARY">Stationary / Inactivity</option>
              <option value="FALL_IMPACT">Fall Impact</option>
              <option value="FREE_FALL">Free Fall Descent</option>
              <option value="SENSOR_CHECK">Sensor Check / Diagnostic</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          {/* Limit selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Show:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>

        {/* Counter readout */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>
            Displaying <strong>{filteredItems.length}</strong> telemetry event packets
          </span>
          {(sourceFilter !== 'ALL' || patientFilter !== 'ALL' || eventTypeFilter !== 'ALL' || severityFilter !== 'ALL' || searchQuery) && (
            <span
              onClick={() => {
                setSourceFilter('ALL');
                setPatientFilter('ALL');
                setEventTypeFilter('ALL');
                setSeverityFilter('ALL');
                setSearchQuery('');
              }}
              style={{ color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reset Filters
            </span>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
        {error ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#f87171' }}>
            <AlertTriangle size={36} style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>Telemetry Database Connection Unavailable</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{error}</p>
            <button onClick={loadUnifiedHistory} className="btn btn-sm btn-primary" style={{ marginTop: '16px' }}>
              Retry Loading
            </button>
          </div>
        ) : loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity className="animate-spin" size={28} style={{ margin: '0 auto 12px auto' }} />
            <p>Aggregating physical hardware and kinematics telemetry packets...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <History size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>No telemetry records match your filters.</p>
            <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
              Adjust filter controls above or trigger a movement simulation.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 14px' }}>Data Source</th>
                  <th style={{ padding: '12px 14px' }}>Device ID</th>
                  <th style={{ padding: '12px 14px' }}>Patient</th>
                  <th style={{ padding: '12px 14px' }}>Movement State</th>
                  <th style={{ padding: '12px 14px' }}>Sensor Metrics &amp; Readout</th>
                  <th style={{ padding: '12px 14px' }}>Severity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Alert</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const isHardware = item.source === 'HARDWARE_PIEZO' || item.source === 'REAL_HARDWARE';
                  const isCritical = item.severity === 'CRITICAL';

                  return (
                    <tr
                      key={item._id || idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: isCritical ? 'rgba(239, 68, 68, 0.06)' : 'transparent',
                        transition: 'background 0.2s',
                      }}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                        <div>{new Date(item.timestamp).toLocaleTimeString()}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {new Date(item.timestamp).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Data Source Badge (Clear Distinction) */}
                      <td style={{ padding: '12px 14px' }}>
                        {isHardware ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                            }}
                          >
                            <Cpu size={12} />
                            REAL HARDWARE PIEZO
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'rgba(14, 165, 233, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(14, 165, 233, 0.35)',
                            }}
                          >
                            <Layers size={12} />
                            SIMULATED KINEMATICS
                          </span>
                        )}
                      </td>

                      {/* Device Code */}
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {item.deviceId}
                      </td>

                      {/* Patient */}
                      <td style={{ padding: '12px 14px' }}>
                        {item.patientId ? (
                          <div>
                            <span style={{ fontWeight: 600 }}>{item.patientId.name || 'Patient'}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              Rm {item.patientId.roomNumber}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Unassigned Tag</span>
                        )}
                      </td>

                      {/* Movement State */}
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge
                          status={
                            isHardware
                              ? item.eventType === 'VIBRATION'
                                ? 'VIBRATION_DETECTED'
                                : item.eventType === 'STATIONARY'
                                ? 'QUIESCENT'
                                : item.eventType
                              : item.movementState || item.eventType
                          }
                          type="movement"
                        />
                      </td>

                      {/* Metrics (Hardware vs Kinematics) */}
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>
                        {isHardware ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div>
                              Raw ADC: <strong>{item.metrics?.raw ?? '--'}</strong> (Base: {item.metrics?.baseline ?? '--'})
                            </div>
                            <div style={{ color: 'var(--text-secondary)' }}>
                              Dev: <strong>{item.metrics?.deviation ?? '--'}</strong> / Thresh:{' '}
                              <strong>{item.metrics?.threshold ?? '--'}</strong> | Vibrations: {item.metrics?.movementCount ?? 0}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div>
                              Accel:{' '}
                              <strong style={{ color: item.metrics?.accelMagnitude > 2.5 ? '#f87171' : 'var(--text-primary)' }}>
                                {item.metrics?.accelMagnitude?.toFixed(2) || '--'} G
                              </strong>
                              {item.impactPeak && (
                                <span style={{ color: '#f87171', marginLeft: '6px' }}>
                                  (Peak: {item.impactPeak.toFixed(2)}G)
                                </span>
                              )}
                            </div>
                            <div style={{ color: 'var(--text-secondary)' }}>
                              Tilt: {item.metrics?.pitch?.toFixed(1) || '--'}° / {item.metrics?.roll?.toFixed(1) || '--'}°
                              {item.freefallDurationMs > 0 && (
                                <span style={{ color: '#fbbf24', marginLeft: '6px' }}>
                                  FF: {item.freefallDurationMs}ms
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Severity */}
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background:
                              item.severity === 'CRITICAL'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : item.severity === 'WARNING'
                                ? 'rgba(245, 158, 11, 0.2)'
                                : 'rgba(100, 116, 139, 0.2)',
                            color:
                              item.severity === 'CRITICAL'
                                ? '#f87171'
                                : item.severity === 'WARNING'
                                ? '#fbbf24'
                                : '#94a3b8',
                          }}
                        >
                          {item.severity || 'INFO'}
                        </span>
                      </td>

                      {/* Alert Generated */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {item.alertGenerated ? (
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
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                            }}
                          >
                            <AlertTriangle size={11} /> YES
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No</span>
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

export const MovementHistoryView = MovementHistory;
export default MovementHistory;
