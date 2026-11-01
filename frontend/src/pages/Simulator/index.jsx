import React, { useState, useEffect } from 'react';
import { Sliders, Zap, Play, Moon, AlertTriangle, ArrowDown, Activity, RefreshCw, CheckCircle2 } from 'lucide-react';
import { usePatients } from '../../context/PatientContext';
import { apiClient } from '../../services/apiClient';
import { sseClient } from '../../services/sseClient';

export const Simulator = () => {
  const { patients } = usePatients();
  const [feedback, setFeedback] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // Synchronize with backend simulator status on mount and via SSE
  useEffect(() => {
    let isMounted = true;
    setLoadingStatus(true);
    setStatusError(null);

    apiClient
      .getSimulatorStatus()
      .then((res) => {
        if (isMounted) {
          if (res && res.success && res.data) {
            setIsSimulating(Boolean(res.data.isAutoRunning));
          } else {
            setStatusError(res?.message || 'Failed to fetch simulator status');
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('[SimulatorView] Error fetching simulator status:', err);
          setStatusError(err.message || 'Error connecting to simulator service');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingStatus(false);
        }
      });

    // Listen for SSE simulator_status events to keep button state updated across tabs
    const unsubStatus = sseClient.on('simulator_status', (data) => {
      if (data && typeof data.isAutoRunning === 'boolean') {
        setIsSimulating(data.isAutoRunning);
      }
    });

    return () => {
      isMounted = false;
      unsubStatus();
    };
  }, []);

  useEffect(() => {
    if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0]._id);
    }
  }, [patients, selectedPatientId]);

  const triggerSim = async (type, patientId, name) => {
    try {
      if (type === 'walk') {
        await apiClient.simulateWalk(patientId);
        setFeedback(`Emitted simulated gait pattern for ${name} (1.18G, upright)`);
      } else if (type === 'inactivity') {
        await apiClient.simulateInactivity(patientId);
        setFeedback(`Emitted simulated resting state for ${name} (0.98G, status updated to STATIONARY)`);
      } else if (type === 'free-fall') {
        await apiClient.simulateFreeFall(patientId);
        setFeedback(`Emitted Stage 1 Free-Fall packet (0.22G) for ${name}`);
      } else if (type === 'impact') {
        await apiClient.simulateImpact(patientId);
        setFeedback(`Emitted Stage 2 Impact Peak packet (3.85G) for ${name}`);
      } else if (type === 'orientation') {
        await apiClient.simulateOrientationChange(patientId);
        setFeedback(`Emitted Stage 3 Posture Tilt packet (delta > 80°) for ${name}`);
      } else if (type === 'fall' || type === 'complete-fall') {
        const res = await apiClient.simulateCompleteFall(patientId);
        setFeedback(`🚨 Multi-Stage Fall Simulation Complete: ${res.data?.patientName || name} -> CRITICAL Alert confirmed with full sensor telemetry!`);
      } else if (type === 'fall-and-recover') {
        const res = await apiClient.simulateFallAndRecover(patientId);
        setFeedback(`🛡️ False-Positive Tested: Patient resumed walking before 10s inactivity. Suspected fall was REJECTED: "${res.data?.rejectionReason}" (0 alerts generated).`);
      }
      setTimeout(() => setFeedback(null), 6000);
    } catch (err) {
      setFeedback(`Simulation error: ${err.message}`);
    }
  };

  const handleToggleAuto = async () => {
    try {
      setIsToggling(true);
      const next = !isSimulating;
      const res = await apiClient.toggleAutoSimulation(next);
      if (res && res.success && res.data) {
        setIsSimulating(Boolean(res.data.isAutoRunning));
        setFeedback(`Automated telemetry simulation ${res.data.isAutoRunning ? 'started' : 'stopped'}.`);
      } else {
        throw new Error(res?.message || 'Failed to toggle auto simulation');
      }
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback(`Error toggling auto simulation: ${err.message}`);
    } finally {
      setIsToggling(false);
    }
  };

  const selectedPatient = patients.find((p) => p._id === selectedPatientId) || patients[0];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders color="#0ea5e9" size={26} />
          Simulation &amp; Kinematics Controls
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Inject deterministic inertial sensor patterns to test the advanced 5-stage fall heuristic pipeline, false-positive rejection, and emergency triage dispatch.
        </p>
      </div>

      {(feedback || statusError) && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface-elevated)',
            border: `1px solid ${statusError ? 'var(--color-danger)' : 'var(--color-brand)'}`,
            fontSize: '0.9rem',
            color: statusError ? '#f87171' : 'inherit',
          }}
        >
          {statusError ? `Simulator Service Error: ${statusError}` : feedback}
        </div>
      )}

      {/* Auto Simulation Loop Toggle */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#0ea5e9" />
            Background Automated Telemetry Loop
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Periodically generates physiological gait and posture updates across all registered patients.
          </p>
        </div>
        <button
          onClick={handleToggleAuto}
          disabled={loadingStatus || isToggling}
          className={`btn ${isSimulating ? 'btn-danger' : 'btn-primary'}`}
          style={{ opacity: loadingStatus || isToggling ? 0.7 : 1 }}
        >
          {loadingStatus
            ? 'Checking Status...'
            : isToggling
            ? 'Updating...'
            : isSimulating
            ? 'Stop Auto Simulation'
            : 'Start Auto Simulation'}
        </button>
      </div>

      {/* Phase 7 Multi-Stage Fall Validation Studio */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#38bdf8" />
              Advanced Multi-Stage Fall Detection Studio (Phase 7)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Evaluate discrete stages or complete physiological fall sequences against the multi-stage heuristic filter.
            </p>
          </div>

          {patients.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target Patient:</span>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {patients.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} (Room {p.roomNumber}-{p.bedNumber})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedPatient && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Complete Physiological Fall */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 700 }}>
                  <AlertTriangle size={18} /> Complete Multi-Stage Fall
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Executes realistic 5-stage progression: Walking &rarr; Free-Fall (&lt;0.5G) &rarr; Impact Peak (4.1G) &rarr; Posture Tilt (&gt;35&deg;) &rarr; 10s Inactivity.
                </p>
              </div>
              <button
                onClick={() => triggerSim('complete-fall', selectedPatient._id, selectedPatient.name)}
                className="btn btn-danger btn-sm"
                style={{ width: '100%', fontWeight: 700 }}
              >
                Trigger Complete Fall Sequence
              </button>
            </div>

            {/* False-Positive Recovery Rejection */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700 }}>
                  <CheckCircle2 size={18} /> Fall &amp; Recovery (False Positive)
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Simulates a patient stumbling/falling into suspected state, then getting up to walk before 10s inactivity. Verifies automatic rejection with zero alerts.
                </p>
              </div>
              <button
                onClick={() => triggerSim('fall-and-recover', selectedPatient._id, selectedPatient.name)}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', borderColor: '#10b981', color: '#10b981' }}
              >
                Trigger Fall &amp; Recovery
              </button>
            </div>

            {/* Individual Stage Step Testing */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Granular Stage Injections:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  onClick={() => triggerSim('free-fall', selectedPatient._id, selectedPatient.name)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '6px 4px' }}
                >
                  <ArrowDown size={12} /> S1 Free-Fall
                </button>
                <button
                  onClick={() => triggerSim('impact', selectedPatient._id, selectedPatient.name)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '6px 4px' }}
                >
                  <Zap size={12} /> S2 Impact
                </button>
                <button
                  onClick={() => triggerSim('orientation', selectedPatient._id, selectedPatient.name)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '6px 4px' }}
                >
                  <RefreshCw size={12} /> S3 Tilt
                </button>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Inspect Real-Time Telemetry to view intermediate stage progression and timeouts.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Patient Injection Grid */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
          Deterministic Event Injection by Patient
        </h3>

        {patients.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No patients found to simulate against.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {patients.map((p) => (
              <div
                key={p._id}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <h4 style={{ fontWeight: 700 }}>{p.name}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Room {p.roomNumber} &bull; Bed {p.bedNumber} &bull; Tag: {p.assignedDeviceId || 'N/A'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => triggerSim('walk', p._id, p.name)}
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem' }}
                  >
                    <Play size={12} /> Walk
                  </button>
                  <button
                    onClick={() => triggerSim('inactivity', p._id, p.name)}
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem' }}
                  >
                    <Moon size={12} /> Inactive
                  </button>
                  <button
                    onClick={() => triggerSim('fall', p._id, p.name)}
                    className="btn btn-sm btn-danger"
                    style={{ flex: 1, fontSize: '0.75rem' }}
                  >
                    <AlertTriangle size={12} /> Simulate Fall
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const SimulatorView = Simulator;
export default Simulator;
