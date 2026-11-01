const sensorService = require('./sensor.service');
const patientRepository = require('../repositories/patient.repository');
const eventRepository = require('../repositories/event.repository');
const sseManager = require('../sockets/sse.manager');

class SimulatorService {
  constructor() {
    this.sequenceCounters = new Map(); // deviceId -> counter
    this.isAutoRunning = false; // Strictly disabled by default
    this.autoInterval = null;
    this.intervalMs = parseInt(process.env.AUTO_SIMULATION_INTERVAL_MS, 10) || 3000;
  }

  async getNextSequence(deviceId) {
    if (!this.sequenceCounters.has(deviceId)) {
      const latestSequence = await eventRepository.getLatestSequenceForDevice(deviceId);
      this.sequenceCounters.set(deviceId, latestSequence);
    }
    const current = this.sequenceCounters.get(deviceId) || 0;
    const next = current + 1;
    this.sequenceCounters.set(deviceId, next);
    return next;
  }

  /**
   * Helper to ensure deviceId and patient exist
   */
  async resolvePatientAndDevice(patientId) {
    let patient;
    if (patientId) {
      patient = await patientRepository.findById(patientId);
    }
    if (!patient) {
      // Pick first admitted patient with a device
      const patients = await patientRepository.findAll({ status: 'ADMITTED' });
      patient = patients.find((p) => p.assignedDeviceId) || patients[0];
    }
    if (!patient) {
      throw new Error('No admitted patient found to simulate telemetry for');
    }

    const deviceId = patient.assignedDeviceId || 'SIM-TAG-DEFAULT';
    return { patient, deviceId };
  }

  /**
   * Scenario 1: Manual Walking Simulation (Deterministic)
   * Produces rhythmic movement (accel magnitude ~ 1.18G)
   */
  async simulateWalk(patientId) {
    const { patient, deviceId } = await this.resolvePatientAndDevice(patientId);
    const sequenceNumber = await this.getNextSequence(deviceId);

    const payload = {
      deviceId,
      patientId: patient._id,
      sequenceNumber,
      timestamp: new Date(),
      movementState: 'WALKING',
      metrics: {
        accelMagnitude: 1.18, // Normal rhythmic walking acceleration
        pitch: 12.5,
        roll: -4.2,
      },
    };

    return await sensorService.ingestTelemetry(payload);
  }

  /**
   * Scenario 2: Manual Inactivity Simulation (Deterministic)
   * Produces motionless readings; updates status badge to STATIONARY only, NO alert!
   */
  async simulateInactivity(patientId) {
    const { patient, deviceId } = await this.resolvePatientAndDevice(patientId);
    const sequenceNumber = await this.getNextSequence(deviceId);

    const payload = {
      deviceId,
      patientId: patient._id,
      sequenceNumber,
      timestamp: new Date(),
      movementState: 'STATIONARY',
      metrics: {
        accelMagnitude: 0.98, // Static 1G gravity with zero dynamic variance
        pitch: 0.5,
        roll: 0.2,
      },
    };

    return await sensorService.ingestTelemetry(payload);
  }

  /**
   * Scenario 3: Stage 1 Free-Fall Sequence
   * Emits low-G descent packet (accel ~ 0.22G)
   */
  async simulateFreeFall(patientId) {
    const { patient, deviceId } = await this.resolvePatientAndDevice(patientId);
    const sequenceNumber = await this.getNextSequence(deviceId);

    const payload = {
      deviceId,
      patientId: patient._id,
      sequenceNumber,
      timestamp: new Date(),
      movementState: 'FREE_FALL',
      metrics: {
        accelMagnitude: 0.22, // Sharp drop below 0.5G threshold
        pitch: 14.5,
        roll: -5.0,
      },
    };

    return await sensorService.ingestTelemetry(payload);
  }

  /**
   * Scenario 4: Stage 2 Impact Sequence
   * Emits high-G strike peak packet (accel ~ 3.85G)
   */
  async simulateImpact(patientId) {
    const { patient, deviceId } = await this.resolvePatientAndDevice(patientId);
    const sequenceNumber = await this.getNextSequence(deviceId);

    const payload = {
      deviceId,
      patientId: patient._id,
      sequenceNumber,
      timestamp: new Date(),
      movementState: 'FALL_IMPACT',
      metrics: {
        accelMagnitude: 3.85, // Sharp high-G impact peak exceeding 2.8G threshold
        pitch: 45.0,
        roll: -40.0,
      },
    };

    return await sensorService.ingestTelemetry(payload);
  }

  /**
   * Scenario 5: Stage 3 Orientation Change Sequence
   * Emits horizontal resting posture packet (pitch/roll tilted > 80°)
   */
  async simulateOrientationChange(patientId) {
    const { patient, deviceId } = await this.resolvePatientAndDevice(patientId);
    const sequenceNumber = await this.getNextSequence(deviceId);

    const payload = {
      deviceId,
      patientId: patient._id,
      sequenceNumber,
      timestamp: new Date(),
      movementState: 'STATIONARY',
      metrics: {
        accelMagnitude: 1.02,
        pitch: 78.4,
        roll: -84.1,
      },
    };

    return await sensorService.ingestTelemetry(payload);
  }

  /**
   * Scenario 6: Stage 4 Post-Impact Inactivity Sequence
   * Emits motionless packet with timestamp advanced by durationSec
   */
  async simulatePostImpactInactivity(patientId, durationSec = 10) {
    const { patient, deviceId } = await this.resolvePatientAndDevice(patientId);
    const sequenceNumber = await this.getNextSequence(deviceId);

    const targetTime = new Date(Date.now() + durationSec * 1000);

    const payload = {
      deviceId,
      patientId: patient._id,
      sequenceNumber,
      timestamp: targetTime,
      movementState: 'STATIONARY',
      metrics: {
        accelMagnitude: 0.98,
        pitch: 78.4,
        roll: -84.1,
      },
    };

    return await sensorService.ingestTelemetry(payload);
  }

  /**
   * Scenario 7: Complete Simulated Fall Scenario (Multi-Stage Physiological Progression)
   * Generates a realistic ordered series of telemetry packets:
   *  1. Walking Baseline (t = 0)
   *  2. Free-Fall Descent (t = +500ms, accel = 0.22G)
   *  3. Impact Peak (t = +900ms, accel = 4.10G)
   *  4. Orientation Posture Change (t = +1200ms, pitch = 78.4°, roll = -84.1°) -> SUSPECTED
   *  5. Post-Impact Inactivity (t = +11500ms, motionless for 10.3s) -> CONFIRMED & CRITICAL ALERT
   */
  async simulateCompleteFall(patientId) {
    const { patient, deviceId } = await this.resolvePatientAndDevice(patientId);
    const baseTime = Date.now();
    const results = [];

    // 1. Walking baseline
    const seq1 = await this.getNextSequence(deviceId);
    const walkRes = await sensorService.ingestTelemetry({
      deviceId,
      patientId: patient._id,
      sequenceNumber: seq1,
      timestamp: new Date(baseTime),
      movementState: 'WALKING',
      metrics: { accelMagnitude: 1.18, pitch: 12.0, roll: -4.0 },
    });
    results.push({ stage: 'BASELINE_WALK', result: walkRes });

    // 2. Free-Fall Descent (500ms later)
    const seq2 = await this.getNextSequence(deviceId);
    const ffRes = await sensorService.ingestTelemetry({
      deviceId,
      patientId: patient._id,
      sequenceNumber: seq2,
      timestamp: new Date(baseTime + 500),
      movementState: 'FREE_FALL',
      metrics: { accelMagnitude: 0.22, pitch: 15.0, roll: -5.0 },
    });
    results.push({ stage: 'FREE_FALL', result: ffRes });

    // 3. Impact Peak (900ms after baseline, 400ms after free-fall)
    const seq3 = await this.getNextSequence(deviceId);
    const impRes = await sensorService.ingestTelemetry({
      deviceId,
      patientId: patient._id,
      sequenceNumber: seq3,
      timestamp: new Date(baseTime + 900),
      movementState: 'FALL_IMPACT',
      metrics: { accelMagnitude: 4.10, pitch: 45.0, roll: -40.0 },
    });
    results.push({ stage: 'IMPACT', result: impRes });

    // 4. Orientation Change (1200ms after baseline) -> Triggers SUSPECTED
    const seq4 = await this.getNextSequence(deviceId);
    const orientRes = await sensorService.ingestTelemetry({
      deviceId,
      patientId: patient._id,
      sequenceNumber: seq4,
      timestamp: new Date(baseTime + 1200),
      movementState: 'STATIONARY',
      metrics: { accelMagnitude: 1.02, pitch: 78.4, roll: -84.1 },
    });
    results.push({ stage: 'ORIENTATION_CHANGE', result: orientRes });

    // 5. Post-Impact Inactivity (11500ms after baseline, 10.3s after orientation change) -> Triggers CONFIRMED
    const seq5 = await this.getNextSequence(deviceId);
    const inactRes = await sensorService.ingestTelemetry({
      deviceId,
      patientId: patient._id,
      sequenceNumber: seq5,
      timestamp: new Date(baseTime + 11500),
      movementState: 'STATIONARY',
      metrics: { accelMagnitude: 0.98, pitch: 78.4, roll: -84.1 },
    });
    results.push({ stage: 'POST_INACTIVITY_CONFIRMATION', result: inactRes });

    return {
      success: true,
      deviceId,
      patientId: patient._id,
      patientName: patient.name,
      stagesEmitted: results.length,
      finalStage: inactRes.detection?.stageName || 'FALL_CONFIRMED',
      alert: inactRes.alert,
      evidence: inactRes.detection?.evidence,
      timeline: results,
    };
  }

  /**
   * Scenario 8: Fall Followed by Patient Recovery (False Positive Rejection)
   * Walking -> Free-Fall -> Impact -> Orientation Change (SUSPECTED) -> Resumed Walking (REJECTED)
   */
  async simulateFallAndRecover(patientId) {
    const { patient, deviceId } = await this.resolvePatientAndDevice(patientId);
    const baseTime = Date.now();
    const results = [];

    // 1. Free-Fall
    const seq1 = await this.getNextSequence(deviceId);
    await sensorService.ingestTelemetry({
      deviceId,
      patientId: patient._id,
      sequenceNumber: seq1,
      timestamp: new Date(baseTime),
      movementState: 'FREE_FALL',
      metrics: { accelMagnitude: 0.25, pitch: 10.0, roll: 0.0 },
    });

    // 2. Impact
    const seq2 = await this.getNextSequence(deviceId);
    await sensorService.ingestTelemetry({
      deviceId,
      patientId: patient._id,
      sequenceNumber: seq2,
      timestamp: new Date(baseTime + 400),
      movementState: 'FALL_IMPACT',
      metrics: { accelMagnitude: 3.90, pitch: 40.0, roll: -30.0 },
    });

    // 3. Orientation Change -> SUSPECTED
    const seq3 = await this.getNextSequence(deviceId);
    const suspectedRes = await sensorService.ingestTelemetry({
      deviceId,
      patientId: patient._id,
      sequenceNumber: seq3,
      timestamp: new Date(baseTime + 800),
      movementState: 'STATIONARY',
      metrics: { accelMagnitude: 1.01, pitch: 80.0, roll: -80.0 },
    });
    results.push({ stage: 'SUSPECTED', result: suspectedRes });

    // 4. Patient gets up and resumes walking at t = 3000ms (before 10s inactivity) -> REJECTED
    const seq4 = await this.getNextSequence(deviceId);
    const recoveryRes = await sensorService.ingestTelemetry({
      deviceId,
      patientId: patient._id,
      sequenceNumber: seq4,
      timestamp: new Date(baseTime + 3000),
      movementState: 'WALKING',
      metrics: { accelMagnitude: 1.25, pitch: 12.0, roll: -3.0 },
    });
    results.push({ stage: 'RECOVERED_REJECTED', result: recoveryRes });

    return {
      success: true,
      deviceId,
      patientId: patient._id,
      patientName: patient.name,
      finalStatus: recoveryRes.detection?.status,
      rejectionReason: recoveryRes.detection?.rejectionReason,
      alertGenerated: !!recoveryRes.alert,
      timeline: results,
    };
  }

  /**
   * Backwards-compatible manual simulateFall endpoint
   * Delegates to full multi-stage fall simulation
   */
  async simulateFall(patientId) {
    return await this.simulateCompleteFall(patientId);
  }

  /**
   * Toggle automatic background simulation loop
   */
  async toggleAutoSimulation(enable) {
    if (enable === undefined) {
      this.isAutoRunning = !this.isAutoRunning;
    } else {
      this.isAutoRunning = Boolean(enable);
    }

    if (this.isAutoRunning) {
      this.startAutoLoop();
    } else {
      this.stopAutoLoop();
    }

    sseManager.broadcast('simulator_status', {
      isAutoRunning: this.isAutoRunning,
      intervalMs: this.intervalMs,
      timestamp: new Date(),
    });

    return {
      isAutoRunning: this.isAutoRunning,
      intervalMs: this.intervalMs,
    };
  }

  startAutoLoop() {
    if (this.autoInterval) clearInterval(this.autoInterval);

    console.log(`[Simulator] Starting background simulation loop (interval: ${this.intervalMs}ms)`);
    this.autoInterval = setInterval(async () => {
      try {
        const patients = await patientRepository.findAll({ status: 'ADMITTED' });
        if (patients.length === 0) return;

        // Pick a patient randomly
        const patient = patients[Math.floor(Math.random() * patients.length)];
        const deviceId = patient.assignedDeviceId || 'SIM-TAG-AUTO';
        const sequenceNumber = await this.getNextSequence(deviceId);

        // 80% walking, 20% stationary
        const isWalk = Math.random() < 0.8;
        const movementState = isWalk ? 'WALKING' : 'STATIONARY';
        const accelMagnitude = isWalk ? Number((1.05 + Math.random() * 0.25).toFixed(2)) : 0.98;

        await sensorService.ingestTelemetry({
          deviceId,
          patientId: patient._id,
          sequenceNumber,
          timestamp: new Date(),
          movementState,
          metrics: {
            accelMagnitude,
            pitch: Number((Math.random() * 20 - 10).toFixed(1)),
            roll: Number((Math.random() * 20 - 10).toFixed(1)),
          },
        });
      } catch (err) {
        console.error(`[Simulator] Auto-loop error: ${err.message}`);
      }
    }, this.intervalMs);
  }

  stopAutoLoop() {
    if (this.autoInterval) {
      clearInterval(this.autoInterval);
      this.autoInterval = null;
    }
    console.log('[Simulator] Background simulation loop stopped.');
  }

  getStatus() {
    return {
      isAutoRunning: this.isAutoRunning,
      intervalMs: this.intervalMs,
      activeCounters: Object.fromEntries(this.sequenceCounters),
    };
  }
}

module.exports = new SimulatorService();
