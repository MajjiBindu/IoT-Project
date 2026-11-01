const eventRepository = require('../repositories/event.repository');
const patientRepository = require('../repositories/patient.repository');
const deviceRepository = require('../repositories/device.repository');
const alertService = require('./alert.service');
const fallDetectionService = require('./fallDetection.service');
const sseManager = require('../sockets/sse.manager');

class SensorService {
  constructor() {
    this.inactivityTimers = new Map(); // deviceId -> timer
  }

  /**
   * Schedule real-time timeout fallback for suspected falls
   * If the patient remains motionless and no further packets arrive,
   * the timer will confirm the fall and trigger the alert.
   */
  scheduleInactivityCheck(deviceId, patientId, remainingMs) {
    if (this.inactivityTimers.has(deviceId)) {
      clearTimeout(this.inactivityTimers.get(deviceId));
      this.inactivityTimers.delete(deviceId);
    }

    const timer = setTimeout(async () => {
      try {
        const state = fallDetectionService.getDeviceState(deviceId);
        if (state && state.stage >= 3 && !state.alertEmitted) {
          console.log(`[SensorService] Real-time inactivity timer elapsed for device ${deviceId}. Confirming fall for patient ${patientId}.`);
          
          // Evaluate a synthetic stationary confirmation packet
          const confirmResult = fallDetectionService.evaluatePacket({
            deviceId,
            patientId,
            sequenceNumber: -1,
            timestamp: new Date(),
            movementState: 'STATIONARY',
            metrics: {
              accelMagnitude: 0.98,
              pitch: state.evidence?.orientationChange?.pitch ?? 75,
              roll: state.evidence?.orientationChange?.roll ?? -80,
            },
          });

          if (confirmResult.status === 'CONFIRMED' && confirmResult.isFirstConfirmation) {
            const alert = await alertService.createFallAlert({
              patientId,
              deviceId,
              triggeredAt: new Date(),
              notes: fallDetectionService.formatEvidenceSummary(confirmResult.evidence),
            });

            await patientRepository.updateMovementStatus(patientId, 'STATIONARY');

            sseManager.broadcast('fall_confirmed', {
              patientId,
              deviceId,
              evidence: confirmResult.evidence,
              alert,
            });

            sseManager.broadcast('patient_status_updated', {
              patientId,
              movementStatus: 'STATIONARY',
              lastMovementUpdate: new Date(),
              timestamp: new Date(),
            });
          }
        }
      } catch (err) {
        console.error(`[SensorService] Error in inactivity timeout handler:`, err);
      } finally {
        this.inactivityTimers.delete(deviceId);
      }
    }, remainingMs);

    this.inactivityTimers.set(deviceId, timer);
  }

  clearInactivityCheck(deviceId) {
    if (this.inactivityTimers.has(deviceId)) {
      clearTimeout(this.inactivityTimers.get(deviceId));
      this.inactivityTimers.delete(deviceId);
    }
  }

  /**
   * Ingest and evaluate incoming telemetry
   * Implements idempotency, multi-stage fall heuristic, and strict inactivity policy
   */
  async ingestTelemetry(payload) {
    const { deviceId, patientId, sequenceNumber, timestamp, movementState, metrics } = payload;

    // 1. Idempotency Check: Reject duplicate packets
    const existing = await eventRepository.findByDeviceAndSequence(deviceId, sequenceNumber);
    if (existing) {
      console.warn(`[SensorService] Duplicate event discarded: deviceId=${deviceId}, sequence=${sequenceNumber}`);
      return {
        success: false,
        duplicate: true,
        message: 'Duplicate event sequence discarded',
        event: existing,
      };
    }

    // 2. Persist Sensor Event
    let sensorEvent;
    try {
      sensorEvent = await eventRepository.create({
        deviceId,
        patientId,
        sequenceNumber,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        movementState,
        metrics: {
          accelMagnitude: metrics?.accelMagnitude ?? 1.0,
          pitch: metrics?.pitch ?? 0,
          roll: metrics?.roll ?? 0,
        },
        processed: true,
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        console.warn(`[SensorService] Duplicate event caught via unique index: deviceId=${deviceId}, sequence=${sequenceNumber}`);
        const duplicateRecord = await eventRepository.findByDeviceAndSequence(deviceId, sequenceNumber);
        return {
          success: false,
          duplicate: true,
          message: 'Duplicate event sequence discarded',
          event: duplicateRecord,
        };
      }
      throw createErr;
    }

    // 3. Advanced Multi-Stage Fall Detection Evaluation
    const detection = fallDetectionService.evaluatePacket({
      deviceId,
      patientId,
      sequenceNumber,
      timestamp: sensorEvent.timestamp,
      movementState,
      metrics: sensorEvent.metrics,
    });

    let generatedAlert = null;

    if (detection.status === 'CONFIRMED' && detection.isFirstConfirmation) {
      this.clearInactivityCheck(deviceId);
      console.log(`[SensorService] CRITICAL FALL CONFIRMED for patient ${patientId} on device ${deviceId}`);

      generatedAlert = await alertService.createFallAlert({
        patientId,
        deviceId,
        triggeredAt: sensorEvent.timestamp,
        notes: fallDetectionService.formatEvidenceSummary(detection.evidence),
      });

      // Update patient status to STATIONARY after fall
      const updatedPatient = await patientRepository.updateMovementStatus(patientId, 'STATIONARY');
      const movementTimestamp = updatedPatient ? updatedPatient.lastMovementUpdate : new Date();

      sseManager.broadcast('fall_confirmed', {
        patientId,
        deviceId,
        evidence: detection.evidence,
        alert: generatedAlert,
      });

      sseManager.broadcast('patient_status_updated', {
        patientId,
        movementStatus: 'STATIONARY',
        lastMovementUpdate: movementTimestamp,
        timestamp: movementTimestamp,
      });
    } else if (detection.status === 'SUSPECTED') {
      // Suspected fall in progress: patient is observed motionless post-impact
      console.log(`[SensorService] Suspected fall under observation for device ${deviceId} (stage=${detection.stage})`);
      
      const updatedPatient = await patientRepository.updateMovementStatus(patientId, 'STATIONARY');
      const movementTimestamp = updatedPatient ? updatedPatient.lastMovementUpdate : new Date();

      sseManager.broadcast('fall_suspected', {
        patientId,
        deviceId,
        stage: detection.stage,
        stageName: detection.stageName,
        message: detection.message,
        evidence: detection.evidence,
      });

      sseManager.broadcast('patient_status_updated', {
        patientId,
        movementStatus: 'STATIONARY',
        lastMovementUpdate: movementTimestamp,
        timestamp: movementTimestamp,
      });

      // Schedule real-time timeout verification if needed
      if (detection.remainingInactivityMs && detection.remainingInactivityMs > 0) {
        this.scheduleInactivityCheck(deviceId, patientId, detection.remainingInactivityMs + 500);
      }
    } else if (detection.status === 'REJECTED') {
      this.clearInactivityCheck(deviceId);
      if (detection.rejectionReason) {
        console.log(`[SensorService] Fall sequence rejected for device ${deviceId}: ${detection.rejectionReason}`);
        sseManager.broadcast('fall_rejected', {
          patientId,
          deviceId,
          reason: detection.rejectionReason,
        });
      }

      // Update movement status based on actual state
      const newStatus = movementState === 'WALKING' ? 'WALKING' : 'STATIONARY';
      const updatedPatient = await patientRepository.updateMovementStatus(patientId, newStatus);
      const movementTimestamp = updatedPatient ? updatedPatient.lastMovementUpdate : new Date();

      sseManager.broadcast('patient_status_updated', {
        patientId,
        movementStatus: newStatus,
        lastMovementUpdate: movementTimestamp,
        timestamp: movementTimestamp,
      });
    } else {
      // Stage 0 / Normal movement progression
      const newStatus = movementState === 'WALKING' ? 'WALKING' : 'STATIONARY';
      const updatedPatient = await patientRepository.updateMovementStatus(patientId, newStatus);
      const movementTimestamp = updatedPatient ? updatedPatient.lastMovementUpdate : new Date();

      sseManager.broadcast('patient_status_updated', {
        patientId,
        movementStatus: newStatus,
        lastMovementUpdate: movementTimestamp,
        timestamp: movementTimestamp,
      });
    }

    // 5. Update device heartbeat
    try {
      await deviceRepository.updateHeartbeat(deviceId);
    } catch (dErr) {
      // Non-blocking if device record is synthetic or unpersisted
    }

    // 6. Broadcast live telemetry event over SSE with detection stage metadata
    sseManager.broadcast('sensor_event', {
      id: sensorEvent._id,
      deviceId,
      patientId,
      sequenceNumber,
      timestamp: sensorEvent.timestamp,
      movementState,
      metrics: sensorEvent.metrics,
      alertGenerated: !!generatedAlert,
      detection: {
        status: detection.status,
        stage: detection.stage,
        stageName: detection.stageName,
        message: detection.message,
      },
    });

    return {
      success: true,
      duplicate: false,
      event: sensorEvent,
      alert: generatedAlert,
      detection,
    };
  }

  async getRecentEventsForPatient(patientId, limit = 50) {
    return await eventRepository.findRecentByPatient(patientId, limit);
  }

  async getAllEvents(query = {}, limit = 100) {
    return await eventRepository.findAll(query, limit);
  }
}

module.exports = new SensorService();
