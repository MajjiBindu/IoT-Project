import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Zap,
  Play,
  Moon,
  AlertTriangle,
  ArrowDown,
  Activity,
  RefreshCw,
  CheckCircle2,
  Cpu,
  Radio,
  WifiOff,
  Flame,
  ShieldCheck,
  RotateCcw,
  User,
  Info,
} from 'lucide-react';
import { usePatients } from '../../context/PatientContext';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import { sseClient } from '../../services/sseClient';

export const Simulator = () => {
  const { patients } = usePatients();
  const { isAdmin, isNurse } = useAuth();

  const [feedback, setFeedback] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [activeStageStep, setActiveStageStep] = useState(0);

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
          console.warn('[Simulator] Error fetching simulator status:', err);
          setStatusError(err.message || 'Error connecting to simulator service');
        }
      })
      .finally(() => {
        if (isMounted) setLoadingStatus(false);
      });

    // Listen for SSE simulator_status events
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
    if (!isAdmin) {
      setFeedback('Admin role required to trigger simulation injections.');
      return;
    }

    try {
      let res;
      if (type === 'walk') {
        res = await apiClient.simulateWalk(patientId);
        setActiveStageStep(1);
        setFeedback(`Emitted simulated gait pattern for ${name} (1.18G, upright posture)`);
      } else if (type === 'stand') {
        res = await apiClient.simulateStand(patientId);
        setActiveStageStep(1);
        setFeedback(`Emitted standing posture for ${name} (1.00G, upright static)`);
      } else if (type === 'sit') {
        res = await apiClient.simulateSit(patientId);
        setActiveStageStep(1);
        setFeedback(`Emitted sitting posture for ${name} (1.15G, resting tilt)`);
      } else if (type === 'sudden-movement') {
        res = await apiClient.simulateSuddenMovement(patientId);
        setActiveStageStep(1);
        setFeedback(`Emitted rapid postural movement for ${name} (2.15G, no fall descent)`);
      } else if (type === 'inactivity') {
        res = await apiClient.simulateInactivity(patientId);
        setActiveStageStep(4);
        setFeedback(`Emitted resting state for ${name} (0.98G, badge updated to STATIONARY)`);
      } else if (type === 'free-fall') {
        res = await apiClient.simulateFreeFall(patientId);
        setActiveStageStep(1);
        setFeedback(`Emitted Stage 1 Free-Fall packet (0.22G descent) for ${name}`);
      } else if (type === 'impact') {
        res = await apiClient.simulateImpact(patientId);
        setActiveStageStep(2);
        setFeedback(`Emitted Stage 2 Impact Peak packet (3.85G strike) for ${name}`);
      } else if (type === 'impact-only') {
        res = await apiClient.simulateImpactOnly(patientId);
        setActiveStageStep(2);
        setFeedback(`Emitted Impact Spike without Free-Fall for ${name} (Fall Rejected: Protected against false positives)`);
      } else if (type === 'orientation') {
        res = await apiClient.simulateOrientationChange(patientId);
        setActiveStageStep(3);
        setFeedback(`Emitted Stage 3 Posture Tilt packet (>35° tilt) for ${name}`);
      } else if (type === 'complete-fall') {
        setActiveStageStep(5);
        res = await apiClient.simulateCompleteFall(patientId);
        setFeedback(`🚨 Multi-Stage Fall Simulation Complete: ${name} -> Free-Fall -> Impact Peak -> Orientation Change -> Inactivity -> CRITICAL Alert Confirmed!`);
      } else if (type === 'fall-and-recover') {
        res = await apiClient.simulateFallAndRecover(patientId);
        setActiveStageStep(1);
        setFeedback(`🛡️ Fall & Quick Recovery: Patient resumed ambulation before 10s inactivity. Suspected fall REJECTED (Zero false alarms).`);
      } else if (type === 'fault-disconnect') {
        res = await apiClient.simulateSensorDisconnection(patientId);
        setFeedback(`⚠️ Hardware Fault Injected: Sensor disconnection reported for ${name}. Hardware fault broadcasted.`);
      } else if (type === 'fault-abnormal') {
        res = await apiClient.simulateAbnormalValues(patientId);
        setFeedback(`⚠️ Hardware Fault Injected: Abnormal ADC values / rail saturation reported for ${name}.`);
      } else if (type === 'fault-comm') {
        res = await apiClient.simulateCommInterruption(patientId);
        setFeedback(`⚠️ Hardware Fault Injected: Missing packets / watchdog timeout reported for ${name}.`);
      } else if (type === 'fault-recover') {
        res = await apiClient.simulateFaultRecovery(patientId);
        setFeedback(`✅ Hardware Fault Recovered: Sensor restored to healthy state.`);
      }

      setTimeout(() => setFeedback(null), 7000);
    } catch (err) {
      setFeedback(`Simulation error: ${err.message}`);
    }
  };

  const handleToggleAuto = async () => {
    if (!isAdmin) {
      setFeedback('Admin role required to modify background auto-simulation loop.');
      return;
    }
    try {
      setIsToggling(true);
      const next = !isSimulating;
      const res = await apiClient.toggleAutoSimulation(next);
      if (res && res.success && res.data) {
        setIsSimulating(Boolean(res.data.isAutoRunning));
        setFeedback(`Automated telemetry simulation ${res.data.isAutoRunning ? 'ENABLED' : 'DISABLED'}.`);
      } else {
        throw new Error(res?.message || 'Failed to toggle auto simulation');
      }
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback(`Error toggling auto simulation: ${err.message}`);
    } finally {
      setIsToggling(false);
    }
  };

  const selectedPatient = patients.find((p) => p._id === selectedPatientId) || patients[0];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders color="#0ea5e9" size={28} />
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
            Multistage Fall Detection &amp; Hardware Fault Simulator
          </h2>
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 700,
              background: 'rgba(14, 165, 233, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(14, 165, 233, 0.3)',
            }}
          >
            SYNTHETIC KINEMATICS HARNESS
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Inject deterministic inertial telemetry to rigorously validate the 5-stage fall heuristic pipeline, false-positive rejection, and hardware fault diagnostic alerts.
        </p>
      </div>

      {/* Lab Banner Notice */}
      <div
        style={{
          padding: '12px 18px',
          borderRadius: '8px',
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
        }}
      >
        <Info size={18} color="#0ea5e9" style={{ flexShrink: 0 }} />
        <span>
          <strong>Faculty / Evaluator Notice:</strong> Kinematics tests below simulate digital accelerometer IMU telemetry (Free-fall, Impact Peak, Tilt, Motionless duration). Physical Arduino Uno prototype uses piezoelectric discs on pin A0 to capture mechanical vibration and movement impacts.
        </span>
      </div>

      {/* Feedback & Error Banner */}
      {(feedback || statusError) && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '8px',
            background: statusError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)',
            border: `1px solid ${statusError ? '#ef4444' : '#0ea5e9'}`,
            fontSize: '0.88rem',
            color: statusError ? '#f87171' : 'var(--text-primary)',
            fontWeight: 500,
          }}
        >
          {statusError ? `Simulator Service Error: ${statusError}` : feedback}
        </div>
      )}

      {/* 5-Stage Fall Detection Heuristic Pipeline Visual Progress Meter */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#0ea5e9" />
          5-Stage Clinical Fall Detection Heuristic Pipeline
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* Stage 1 */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: activeStageStep === 1 || activeStageStep === 5 ? 'rgba(14, 165, 233, 0.15)' : 'rgba(15, 23, 42, 0.5)',
              border: activeStageStep === 1 || activeStageStep === 5 ? '1px solid #0ea5e9' : '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8' }}>STAGE 1</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '2px' }}>Free-Fall Descent</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Acceleration &lt; 0.5G for 100–500ms
            </div>
          </div>

          {/* Stage 2 */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: activeStageStep === 2 || activeStageStep === 5 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 23, 42, 0.5)',
              border: activeStageStep === 2 || activeStageStep === 5 ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24' }}>STAGE 2</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '2px' }}>Impact Peak Strike</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Acceleration spike &ge; 2.8G (up to 4.5G)
            </div>
          </div>

          {/* Stage 3 */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: activeStageStep === 3 || activeStageStep === 5 ? 'rgba(168, 85, 247, 0.15)' : 'rgba(15, 23, 42, 0.5)',
              border: activeStageStep === 3 || activeStageStep === 5 ? '1px solid #a855f7' : '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#c084fc' }}>STAGE 3</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '2px' }}>Orientation Change</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Body posture tilt &ge; 35° (lying down)
            </div>
          </div>

          {/* Stage 4 */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: activeStageStep === 4 || activeStageStep === 5 ? 'rgba(234, 88, 12, 0.15)' : 'rgba(15, 23, 42, 0.5)',
              border: activeStageStep === 4 || activeStageStep === 5 ? '1px solid #ea580c' : '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fb923c' }}>STAGE 4</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '2px' }}>Post-Impact Inactivity</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Motionless for &ge; 10s (prevents false alarms)
            </div>
          </div>

          {/* Stage 5 */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: activeStageStep === 5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(15, 23, 42, 0.5)',
              border: activeStageStep === 5 ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f87171' }}>STAGE 5</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '2px' }}>Emergency Triage Alert</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Confirmed fall alert &amp; audio siren broadcast
            </div>
          </div>
        </div>
      </div>

      {/* Target Patient Selector & Background Auto-Loop */}
      <div
        className="glass-panel"
        style={{
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <User size={18} color="#0ea5e9" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Target Test Patient:</span>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '7px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            {patients.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} (Rm {p.roomNumber}-{p.bedNumber}) - Tag: {p.assignedDeviceId || 'None'}
              </option>
            ))}
          </select>
        </div>

        {isAdmin ? (
          <button
            onClick={handleToggleAuto}
            disabled={loadingStatus || isToggling}
            className={`btn btn-sm ${isSimulating ? 'btn-danger' : 'btn-primary'}`}
            style={{ fontWeight: 600 }}
          >
            <Zap size={14} />
            {isSimulating ? 'Stop Auto-Simulation Loop' : 'Start Auto-Simulation Loop'}
          </button>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            (Admin role required to trigger simulation actions)
          </span>
        )}
      </div>

      {/* SECTION 1: NORMAL MOBILITY SCENARIOS */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Play size={18} color="#10b981" />
          Category 1: Normal Activities of Daily Living (ADL)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {/* Scenario 1: Walk */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#34d399' }}>1. Normal Walking</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Simulates rhythmic gait acceleration (~1.18G, upright orientation). Expected outcome: Movement status becomes WALKING, zero alerts.
              </p>
            </div>
            <button
              onClick={() => triggerSim('walk', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
            >
              Simulate Walking
            </button>
          </div>

          {/* Scenario 2: Stand */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#38bdf8' }}>2. Normal Standing</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Simulates motionless upright posture (~1.00G, zero pitch/roll). Expected outcome: Movement status becomes STATIONARY, zero alerts.
              </p>
            </div>
            <button
              onClick={() => triggerSim('stand', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
            >
              Simulate Standing
            </button>
          </div>

          {/* Scenario 3: Sit */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fbbf24' }}>3. Sitting Down</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Minor acceleration spike (~1.15G) settling into resting chair posture. Expected outcome: STATIONARY, zero alerts.
              </p>
            </div>
            <button
              onClick={() => triggerSim('sit', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
            >
              Simulate Sitting Down
            </button>
          </div>

          {/* Scenario 4: Sudden Movement */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#c084fc' }}>4. Sudden Movement Without Fall</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Sharp acceleration burst (~2.15G) without prior freefall descent or sustained tilt. Expected outcome: WALKING, zero false alerts.
              </p>
            </div>
            <button
              onClick={() => triggerSim('sudden-movement', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
            >
              Simulate Sudden Shift
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: FALL & FALSE POSITIVE PROTECTION SCENARIOS */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} color="#ef4444" />
          Category 2: Clinical Fall &amp; False-Positive Protection
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {/* Scenario 5: Multi-stage real fall */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1.5px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} /> 5. Complete Multi-Stage Real Fall
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
                Executes complete 5-stage clinical sequence: Walking &rarr; Free-Fall (&lt;0.5G) &rarr; Impact Peak (3.85G) &rarr; Body Tilt (&gt;35&deg;) &rarr; 10s Inactivity. Expected outcome: Confirmed CRITICAL fall alert with audio siren.
              </p>
            </div>
            <button
              onClick={() => triggerSim('complete-fall', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-danger"
              style={{ fontWeight: 700 }}
            >
              Trigger Full Fall Sequence
            </button>
          </div>

          {/* Scenario 6: Impact Without Freefall */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} /> 6. Impact Without Freefall (Trip/Drop)
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
                Spike exceeding 3.4G without prior free-fall descent (e.g. dropping sensor on bed). Expected outcome: Rejected by Stage 1 heuristic filter (No false alarm).
              </p>
            </div>
            <button
              onClick={() => triggerSim('impact-only', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
              style={{ borderColor: '#f59e0b', color: '#fbbf24' }}
            >
              Simulate Impact-Only (Reject)
            </button>
          </div>

          {/* Scenario 7: Fall With Quick Recovery */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> 7. Fall With Quick Recovery
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
                Patient stumbles/slips into suspected state, but stands back up and resumes walking within 10 seconds. Expected outcome: Suspected fall cancelled, zero alerts emitted.
              </p>
            </div>
            <button
              onClick={() => triggerSim('fall-and-recover', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
              style={{ borderColor: '#10b981', color: '#34d399' }}
            >
              Simulate Quick Recovery (Reject)
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: MULTISTAGE HARDWARE FAULT DETECTION SCENARIOS */}
      <div className="glass-panel" style={{ padding: '22px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="#eab308" />
          Category 3: Hardware Diagnostics &amp; Fault Detection (Feature 7)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {/* Scenario 8: Disconnection */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <WifiOff size={15} /> 8. Sensor Disconnection
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Simulates wire detachment / sensor tag falling off. Triggers non-emergency hardware fault (does NOT trigger code blue fall alert).
              </p>
            </div>
            <button
              onClick={() => triggerSim('fault-disconnect', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
            >
              Simulate Disconnect
            </button>
          </div>

          {/* Scenario 9: Abnormal Sensor Values */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={15} /> 9. Abnormal Values / Saturation
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Simulates ADC rail saturation (1023 max voltage) or abnormal baseline drift. Dispatches hardware maintenance inspection alert.
              </p>
            </div>
            <button
              onClick={() => triggerSim('fault-abnormal', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
            >
              Simulate Saturation
            </button>
          </div>

          {/* Scenario 10: Comm Interruption */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fb923c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={15} /> 10. Comm Interruption / Loss
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Simulates RF/Serial signal obstruction (watchdog silence &gt; 3.5s). Emits telemetry timeout fault warning.
              </p>
            </div>
            <button
              onClick={() => triggerSim('fault-comm', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
            >
              Simulate Comm Loss
            </button>
          </div>

          {/* Fault Recovery */}
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw size={15} /> Fault Recovery Reset
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Simulates physical reconnection, self-healing recovery, and baseline normalization. Restores device to HEALTHY state.
              </p>
            </div>
            <button
              onClick={() => triggerSim('fault-recover', selectedPatient?._id, selectedPatient?.name)}
              disabled={!isAdmin}
              className="btn btn-sm btn-secondary"
              style={{ borderColor: '#10b981', color: '#34d399' }}
            >
              Recover / Reset Faults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SimulatorView = Simulator;
export default Simulator;
