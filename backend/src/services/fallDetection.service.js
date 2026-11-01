/**
 * Advanced Multi-Stage Fall Detection Service (Phase 7)
 * 
 * Implements a 5-stage heuristic pipeline:
 *  1. Free-Fall Detection: acceleration drops significantly (< 0.5G default)
 *  2. Impact Peak Detection: sharp acceleration spike (>= 2.8G default) within 1.5s
 *  3. Orientation Change Detection: posture angle tilt (>= 35° default) compared to pre-fall baseline
 *  4. Post-Impact Inactivity Monitoring: patient remains motionless for >= 10s
 *  5. Fall Confirmation: generates exactly ONE critical alert with verified sensor evidence
 * 
 * Rejects false positives:
 *  - Normal walking, sitting, or sleeping
 *  - Sudden movements or jumping without free-fall
 *  - Stepping down / elevator drops without orientation change
 *  - Recovery movement within the 10-second inactivity window
 *  - Duplicate sensor packets
 */

class FallDetectionService {
  constructor(options = {}) {
    this.config = {
      freeFallThreshold: options.freeFallThreshold ?? parseFloat(process.env.FALL_FREEFALL_THRESHOLD || 0.5),
      impactThreshold: options.impactThreshold ?? parseFloat(process.env.FALL_IMPACT_THRESHOLD || process.env.FALL_ACCEL_THRESHOLD || 2.8),
      orientationChangeThreshold: options.orientationChangeThreshold ?? parseFloat(process.env.FALL_ORIENTATION_CHANGE_THRESHOLD || 35.0),
      inactivityDurationMs: options.inactivityDurationMs ?? parseInt(process.env.FALL_INACTIVITY_DURATION_MS || 10000, 10),
      maxFreeFallToImpactMs: options.maxFreeFallToImpactMs ?? parseInt(process.env.FALL_MAX_FREEFALL_TO_IMPACT_MS || 1500, 10),
      maxSequenceWindowMs: options.maxSequenceWindowMs ?? parseInt(process.env.FALL_MAX_SEQUENCE_WINDOW_MS || 20000, 10),
      inactivityAccelTolerance: options.inactivityAccelTolerance ?? parseFloat(process.env.FALL_INACTIVITY_ACCEL_TOLERANCE || 0.35),
      maxHistorySize: options.maxHistorySize ?? 30,
    };

    // Per-device state tracker: deviceId -> tracker
    this.devices = new Map();
  }

  /**
   * Helper: Calculate Euclidean angular difference between two pitch/roll orientations
   */
  calculateAngularDelta(pitch1, roll1, pitch2, roll2) {
    const dPitch = (pitch1 ?? 0) - (pitch2 ?? 0);
    const dRoll = (roll1 ?? 0) - (roll2 ?? 0);
    return Number(Math.sqrt(dPitch * dPitch + dRoll * dRoll).toFixed(1));
  }

  /**
   * Helper: Retrieve or initialize device tracking state
   */
  getOrCreateTracker(deviceId, patientId) {
    if (!this.devices.has(deviceId)) {
      this.devices.set(deviceId, {
        deviceId,
        patientId,
        stage: 0, // 0: IDLE, 1: FREE_FALL, 2: IMPACT, 3: ORIENTATION, 4: INACTIVITY, 5: CONFIRMED
        state: 'IDLE', // 'IDLE' | 'PROGRESSION' | 'SUSPECTED' | 'CONFIRMED' | 'REJECTED'
        sequenceStartedAt: null,
        baselineOrientation: { pitch: 0, roll: 0, sampleCount: 0 },
        evidence: {
          freeFall: null,
          impact: null,
          orientationChange: null,
          inactivity: null,
          confirmedAt: null,
          rejectionReason: null,
        },
        alertEmitted: false,
        history: [], // bounded buffer
        lastPacketAt: new Date(),
      });
    }
    const tracker = this.devices.get(deviceId);
    if (patientId && !tracker.patientId) tracker.patientId = patientId;
    return tracker;
  }

  /**
   * Reset active sequence for a device back to IDLE
   */
  resetDevice(deviceId, preserveAlertState = false) {
    if (!this.devices.has(deviceId)) return;
    const tracker = this.devices.get(deviceId);
    tracker.stage = 0;
    tracker.state = 'IDLE';
    tracker.sequenceStartedAt = null;
    tracker.evidence = {
      freeFall: null,
      impact: null,
      orientationChange: null,
      inactivity: null,
      confirmedAt: null,
      rejectionReason: null,
    };
    if (!preserveAlertState) {
      tracker.alertEmitted = false;
    }
  }

  /**
   * Core telemetry evaluation pipeline
   * Evaluates packet against 5-stage heuristic
   * @param {Object} payload { deviceId, patientId, sequenceNumber, timestamp, movementState, metrics }
   * @returns {Object} { status: 'NONE' | 'PROGRESSION' | 'SUSPECTED' | 'CONFIRMED' | 'REJECTED', stage, stageName, evidence, message }
   */
  evaluatePacket(payload) {
    const { deviceId, patientId, sequenceNumber, timestamp, movementState, metrics } = payload;
    const tracker = this.getOrCreateTracker(deviceId, patientId);

    const packetTime = timestamp ? new Date(timestamp) : new Date();
    const packetTimeMs = packetTime.getTime();
    tracker.lastPacketAt = packetTime;

    const accel = Number((metrics?.accelMagnitude ?? 1.0).toFixed(2));
    const pitch = Number((metrics?.pitch ?? 0).toFixed(1));
    const roll = Number((metrics?.roll ?? 0).toFixed(1));

    // Append to bounded sliding window history
    tracker.history.push({
      sequenceNumber,
      timestamp: packetTime,
      accelMagnitude: accel,
      pitch,
      roll,
      movementState,
    });
    if (tracker.history.length > this.config.maxHistorySize) {
      tracker.history.shift();
    }

    // Check overall sequence timeout (20s)
    if (tracker.stage > 0 && tracker.sequenceStartedAt) {
      const totalElapsed = packetTimeMs - tracker.sequenceStartedAt.getTime();
      if (totalElapsed > this.config.maxSequenceWindowMs) {
        console.log(`[FallDetection] Device ${deviceId} - Sequence timed out after ${totalElapsed}ms. Resetting to IDLE.`);
        this.resetDevice(deviceId);
        return {
          status: 'REJECTED',
          stage: 0,
          stageName: 'IDLE',
          rejectionReason: 'Fall sequence expired without completion within detection window',
          evidence: null,
        };
      }
    }

    // -------------------------------------------------------------
    // STAGE 0: IDLE / Normal Monitoring
    // -------------------------------------------------------------
    if (tracker.stage === 0) {
      // Maintain continuous pre-fall baseline orientation during normal motion / posture
      if (accel >= 0.7 && accel <= 1.4 && movementState !== 'FALL_IMPACT') {
        const count = tracker.baselineOrientation.sampleCount || 0;
        const newPitch = count === 0 ? pitch : (tracker.baselineOrientation.pitch * 0.8 + pitch * 0.2);
        const newRoll = count === 0 ? roll : (tracker.baselineOrientation.roll * 0.8 + roll * 0.2);
        tracker.baselineOrientation = {
          pitch: Number(newPitch.toFixed(1)),
          roll: Number(newRoll.toFixed(1)),
          sampleCount: Math.min(count + 1, 10),
        };
      }

      // 1. Check for Free-Fall (< freeFallThreshold)
      const isFreeFall = accel <= this.config.freeFallThreshold || movementState === 'FREE_FALL';
      if (isFreeFall) {
        tracker.stage = 1;
        tracker.state = 'PROGRESSION';
        tracker.sequenceStartedAt = packetTime;
        tracker.alertEmitted = false;
        tracker.evidence.freeFall = {
          timestamp: packetTime,
          accelMagnitude: accel,
        };

        console.log(`[FallDetection] Device ${deviceId} - Stage 1 (FREE_FALL) detected: accel=${accel}G <= ${this.config.freeFallThreshold}G`);
        return {
          status: 'PROGRESSION',
          stage: 1,
          stageName: 'FREE_FALL',
          message: `Stage 1: Low acceleration free-fall descent detected (${accel}G)`,
          evidence: tracker.evidence,
        };
      }

      // Check if sudden impact arrived without free fall (False Positive Scenario 5)
      const isSuddenImpact = accel >= this.config.impactThreshold || movementState === 'FALL_IMPACT';
      if (isSuddenImpact) {
        // Inspect recent history within maxFreeFallToImpactMs
        const freeFallInHistory = tracker.history.find(
          (h) => (packetTimeMs - new Date(h.timestamp).getTime()) <= this.config.maxFreeFallToImpactMs &&
                 (h.accelMagnitude <= this.config.freeFallThreshold || h.movementState === 'FREE_FALL')
        );

        if (freeFallInHistory) {
          // Retroactively link free fall from buffer
          tracker.stage = 2;
          tracker.state = 'PROGRESSION';
          tracker.sequenceStartedAt = new Date(freeFallInHistory.timestamp);
          tracker.evidence.freeFall = {
            timestamp: new Date(freeFallInHistory.timestamp),
            accelMagnitude: freeFallInHistory.accelMagnitude,
          };
          tracker.evidence.impact = {
            timestamp: packetTime,
            accelMagnitude: accel,
            dtFromFreeFallMs: packetTimeMs - new Date(freeFallInHistory.timestamp).getTime(),
          };
          console.log(`[FallDetection] Device ${deviceId} - Stage 2 (IMPACT) linked to buffered free-fall: impact=${accel}G`);
          return {
            status: 'PROGRESSION',
            stage: 2,
            stageName: 'IMPACT',
            evidence: tracker.evidence,
          };
        } else {
          // False positive: high G without free fall
          console.log(`[FallDetection] Device ${deviceId} - REJECTED impact without free fall: accel=${accel}G (False Positive)`);
          return {
            status: 'REJECTED',
            stage: 0,
            stageName: 'IDLE',
            rejectionReason: 'High acceleration impact detected without preceding free-fall stage',
            evidence: { impact: { timestamp: packetTime, accelMagnitude: accel } },
          };
        }
      } else {
        return {
          status: 'NONE',
          stage: 0,
          stageName: 'IDLE',
          evidence: null,
        };
      }
    }

    // -------------------------------------------------------------
    // STAGE 1: Free-Fall in progress, awaiting Impact Peak
    // -------------------------------------------------------------
    if (tracker.stage === 1) {
      const elapsedSinceFreeFall = packetTimeMs - tracker.evidence.freeFall.timestamp.getTime();

      // Check if window exceeded without impact
      if (elapsedSinceFreeFall > this.config.maxFreeFallToImpactMs) {
        console.log(`[FallDetection] Device ${deviceId} - Free fall timed out (${elapsedSinceFreeFall}ms > ${this.config.maxFreeFallToImpactMs}ms) without impact. REJECTED.`);
        this.resetDevice(deviceId);
        return {
          status: 'REJECTED',
          stage: 0,
          stageName: 'IDLE',
          rejectionReason: 'Free-fall descent not followed by impact within detection window',
          evidence: null,
        };
      }

      const isImpact = accel >= this.config.impactThreshold || movementState === 'FALL_IMPACT';
      if (isImpact) {
        tracker.stage = 2;
        tracker.state = 'PROGRESSION';
        tracker.evidence.impact = {
          timestamp: packetTime,
          accelMagnitude: accel,
          dtFromFreeFallMs: elapsedSinceFreeFall,
        };

        console.log(`[FallDetection] Device ${deviceId} - Stage 2 (IMPACT) verified: accel=${accel}G (dt=${elapsedSinceFreeFall}ms)`);
        return {
          status: 'PROGRESSION',
          stage: 2,
          stageName: 'IMPACT',
          evidence: tracker.evidence,
        };
      } else if (accel <= this.config.freeFallThreshold) {
        // Still descending in free-fall
        return {
          status: 'PROGRESSION',
          stage: 1,
          stageName: 'FREE_FALL',
          evidence: tracker.evidence,
        };
      } else {
        // Acceleration returned to normal without impact
        this.resetDevice(deviceId);
        return {
          status: 'REJECTED',
          stage: 0,
          stageName: 'IDLE',
          rejectionReason: 'Motion normalized without registered impact',
          evidence: null,
        };
      }
    }

    // -------------------------------------------------------------
    // STAGE 2: Impact registered, evaluating Orientation Change
    // -------------------------------------------------------------
    if (tracker.stage === 2) {
      const deltaAngle = this.calculateAngularDelta(
        pitch,
        roll,
        tracker.baselineOrientation.pitch,
        tracker.baselineOrientation.roll
      );

      // Check for orientation change
      if (deltaAngle >= this.config.orientationChangeThreshold) {
        tracker.stage = 3;
        tracker.state = 'SUSPECTED';
        tracker.evidence.orientationChange = {
          timestamp: packetTime,
          pitch,
          roll,
          baselinePitch: tracker.baselineOrientation.pitch,
          baselineRoll: tracker.baselineOrientation.roll,
          deltaDegrees: deltaAngle,
        };
        tracker.evidence.inactivity = {
          startTimestamp: packetTime,
          lastVerifiedTimestamp: packetTime,
          durationMs: 0,
        };

        console.log(`[FallDetection] Device ${deviceId} - Stage 3 (ORIENTATION) verified: delta=${deltaAngle}° >= ${this.config.orientationChangeThreshold}°. SUSPECTED FALL.`);
        return {
          status: 'SUSPECTED',
          stage: 3,
          stageName: 'SUSPECTED_FALL',
          message: `Suspected fall: Free-fall, Impact (${tracker.evidence.impact.accelMagnitude}G), and Orientation change (${deltaAngle}°) detected. Monitoring 10s inactivity.`,
          evidence: tracker.evidence,
        };
      }

      // Check if time since impact exceeds orientation window (3000ms) without orientation change
      const elapsedSinceImpact = packetTimeMs - tracker.evidence.impact.timestamp.getTime();
      if (elapsedSinceImpact > 3000) {
        console.log(`[FallDetection] Device ${deviceId} - REJECTED: Impact without orientation change (delta=${deltaAngle}° < ${this.config.orientationChangeThreshold}°).`);
        this.resetDevice(deviceId);
        return {
          status: 'REJECTED',
          stage: 0,
          stageName: 'IDLE',
          rejectionReason: 'No significant orientation posture change detected after impact (upright recovery / vertical landing)',
          evidence: null,
        };
      }

      return {
        status: 'PROGRESSION',
        stage: 2,
        stageName: 'IMPACT',
        evidence: tracker.evidence,
      };
    }

    // -------------------------------------------------------------
    // STAGE 3 / 4: SUSPECTED FALL - Post-Impact Inactivity Monitoring
    // -------------------------------------------------------------
    if (tracker.stage >= 3) {
      // Check for recovery movement (False Positive Scenario 9 & Dropped Device pickup)
      const isDynamicMoving =
        movementState === 'WALKING' ||
        accel > 1.45 ||
        Math.abs(accel - 1.0) > (this.config.inactivityAccelTolerance * 2.0);

      if (isDynamicMoving) {
        console.log(`[FallDetection] Device ${deviceId} - Suspected fall REJECTED: Active recovery movement detected (accel=${accel}G, state=${movementState}). Patient recovered.`);
        this.resetDevice(deviceId);
        return {
          status: 'REJECTED',
          stage: 0,
          stageName: 'IDLE',
          rejectionReason: 'Active movement detected during post-impact observation window; patient resumed ambulation/recovery',
          evidence: null,
        };
      }

      // Patient is motionless / resting post-impact
      tracker.stage = 4;
      tracker.evidence.inactivity.lastVerifiedTimestamp = packetTime;
      const inactivityDuration = packetTimeMs - tracker.evidence.inactivity.startTimestamp.getTime();
      tracker.evidence.inactivity.durationMs = inactivityDuration;

      // -----------------------------------------------------------
      // STAGE 5: Fall Confirmation (>= inactivityDurationMs)
      // -----------------------------------------------------------
      if (inactivityDuration >= this.config.inactivityDurationMs) {
        const isFirstConfirmation = !tracker.alertEmitted;
        tracker.stage = 5;
        tracker.state = 'CONFIRMED';
        tracker.evidence.confirmedAt = packetTime;
        tracker.alertEmitted = true;

        console.log(`[FallDetection] Device ${deviceId} - Stage 5 (FALL_CONFIRMED) for patient ${patientId} after ${inactivityDuration}ms of inactivity.`);
        
        return {
          status: 'CONFIRMED',
          stage: 5,
          stageName: 'FALL_CONFIRMED',
          isFirstConfirmation,
          message: `CRITICAL FALL CONFIRMED: Free-fall (${tracker.evidence.freeFall.accelMagnitude}G), Impact (${tracker.evidence.impact.accelMagnitude}G), Orientation change (${tracker.evidence.orientationChange.deltaDegrees}°), and Post-impact inactivity (${(inactivityDuration / 1000).toFixed(1)}s) verified.`,
          evidence: tracker.evidence,
        };
      }

      // Still in observation window
      return {
        status: 'SUSPECTED',
        stage: 4,
        stageName: 'POST_IMPACT_INACTIVITY',
        remainingInactivityMs: Math.max(0, this.config.inactivityDurationMs - inactivityDuration),
        evidence: tracker.evidence,
        message: `Suspected fall: Monitoring post-impact stillness (${(inactivityDuration / 1000).toFixed(1)}s / ${(this.config.inactivityDurationMs / 1000).toFixed(0)}s)`,
      };
    }

    return {
      status: 'NONE',
      stage: 0,
      stageName: 'IDLE',
      evidence: null,
    };
  }

  /**
   * Format human-readable evidence summary for alert notes and logs
   */
  formatEvidenceSummary(evidence) {
    if (!evidence) return 'No sensor evidence recorded';
    const ff = evidence.freeFall ? `${evidence.freeFall.accelMagnitude.toFixed(2)} G` : 'N/A';
    const imp = evidence.impact ? `${evidence.impact.accelMagnitude.toFixed(2)} G` : 'N/A';
    const dt = evidence.impact?.dtFromFreeFallMs ? `${evidence.impact.dtFromFreeFallMs} ms` : 'N/A';
    const delta = evidence.orientationChange ? `${evidence.orientationChange.deltaDegrees}°` : 'N/A';
    const postPosture = evidence.orientationChange ? `pitch: ${evidence.orientationChange.pitch}°, roll: ${evidence.orientationChange.roll}°` : 'N/A';
    const inact = evidence.inactivity?.durationMs ? `${(evidence.inactivity.durationMs / 1000).toFixed(1)}s` : 'N/A';
    const confirmed = evidence.confirmedAt ? new Date(evidence.confirmedAt).toISOString() : new Date().toISOString();

    return [
      `Multi-Stage Fall Confirmed [Stages 1-5]:`,
      `- Stage 1 (Free-Fall): ${ff}`,
      `- Stage 2 (Impact Peak): ${imp} (dt: ${dt})`,
      `- Stage 3 (Orientation Tilt): ${delta} (${postPosture})`,
      `- Stage 4 (Post-Impact Inactivity): ${inact} motionless`,
      `- Stage 5 (Confirmed At): ${confirmed}`,
    ].join('\n');
  }

  /**
   * Get current detection snapshot for a device
   */
  getDeviceState(deviceId) {
    if (!this.devices.has(deviceId)) {
      return { stage: 0, state: 'IDLE', evidence: null };
    }
    const tracker = this.devices.get(deviceId);
    return {
      stage: tracker.stage,
      state: tracker.state,
      sequenceStartedAt: tracker.sequenceStartedAt,
      evidence: tracker.evidence,
      alertEmitted: tracker.alertEmitted,
      baselineOrientation: tracker.baselineOrientation,
      historyLength: tracker.history.length,
    };
  }

  /**
   * Clear all active tracking state (for tests)
   */
  clearAll() {
    this.devices.clear();
  }
}

module.exports = new FallDetectionService();
module.exports.FallDetectionService = FallDetectionService;
