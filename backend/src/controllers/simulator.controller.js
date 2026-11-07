const simulatorService = require('../services/simulator.service');

class SimulatorController {
  async simulateWalk(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateWalk(patientId);
      res.json({
        success: true,
        scenario: 'WALKING',
        message: 'Walking movement telemetry emitted successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateStand(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateStand(patientId);
      res.json({
        success: true,
        scenario: 'STANDING',
        message: 'Standing telemetry emitted; posture upright (STATIONARY)',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateSit(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateSit(patientId);
      res.json({
        success: true,
        scenario: 'SITTING',
        message: 'Sitting down telemetry emitted; settling into resting posture',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateSuddenMovement(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateSuddenMovement(patientId);
      res.json({
        success: true,
        scenario: 'SUDDEN_MOVEMENT',
        message: 'Sudden movement telemetry emitted; classified as dynamic movement without fall',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateImpactOnly(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateImpactOnly(patientId);
      res.json({
        success: true,
        scenario: 'IMPACT_ONLY',
        message: 'Impact spike without prior freefall descent emitted (fall rejected / false positive protection)',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateSensorDisconnection(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateSensorDisconnection(patientId);
      res.json({
        success: true,
        scenario: 'FAULT_DISCONNECTED',
        message: 'Sensor disconnection fault simulated; hardware alert dispatched',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateAbnormalValues(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateAbnormalValues(patientId);
      res.json({
        success: true,
        scenario: 'FAULT_ABNORMAL_VALUES',
        message: 'Abnormal ADC sensor values / upper rail saturation simulated',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateCommInterruption(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateCommInterruption(patientId);
      res.json({
        success: true,
        scenario: 'FAULT_COMM_INTERRUPT',
        message: 'Communication interruption simulated (telemetry watchdog triggered)',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateFaultRecovery(req, res, next) {
    try {
      const { patientId, faultType } = req.body;
      const result = await simulatorService.simulateFaultRecovery(patientId, faultType);
      res.json({
        success: true,
        scenario: 'FAULT_RECOVERY',
        message: 'Hardware fault recovery simulated; device restored to healthy state',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateInactivity(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateInactivity(patientId);
      res.json({
        success: true,
        scenario: 'INACTIVITY',
        message: 'Stationary telemetry emitted; movement status updated to STATIONARY (zero alerts generated)',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateFreeFall(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateFreeFall(patientId);
      res.json({
        success: true,
        scenario: 'FREE_FALL',
        message: 'Stage 1 Free-fall descent telemetry emitted (< 0.5G)',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateImpact(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateImpact(patientId);
      res.json({
        success: true,
        scenario: 'IMPACT',
        message: 'Stage 2 Impact peak telemetry emitted (>= 2.8G)',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateOrientationChange(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateOrientationChange(patientId);
      res.json({
        success: true,
        scenario: 'ORIENTATION_CHANGE',
        message: 'Stage 3 Orientation change posture telemetry emitted (tilt >= 35°)',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulatePostImpactInactivity(req, res, next) {
    try {
      const { patientId, durationSec } = req.body;
      const result = await simulatorService.simulatePostImpactInactivity(patientId, durationSec);
      res.json({
        success: true,
        scenario: 'POST_IMPACT_INACTIVITY',
        message: 'Stage 4 Post-impact inactivity telemetry emitted',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateCompleteFall(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateCompleteFall(patientId);
      res.status(201).json({
        success: true,
        scenario: 'MULTI_STAGE_FALL',
        message: 'Complete multi-stage fall simulation executed: walking -> free-fall -> impact -> orientation change -> post-impact inactivity -> CRITICAL alert confirmed',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateFallAndRecover(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateFallAndRecover(patientId);
      res.json({
        success: true,
        scenario: 'FALL_AND_RECOVER',
        message: 'Fall and recovery simulation executed: suspected fall rejected due to resumed ambulation (zero alerts generated)',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulateFall(req, res, next) {
    try {
      const { patientId } = req.body;
      const result = await simulatorService.simulateFall(patientId);
      res.status(201).json({
        success: true,
        scenario: 'FALL_IMPACT',
        message: 'Multi-stage fall simulation executed; CRITICAL alert confirmed with full sensor evidence',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getStatus(req, res) {
    const status = simulatorService.getStatus();
    res.json({ success: true, data: status });
  }

  async toggleAutoLoop(req, res, next) {
    try {
      const { enable } = req.body;
      const result = await simulatorService.toggleAutoSimulation(enable);
      res.json({
        success: true,
        message: `Background auto-simulation is now ${result.isAutoRunning ? 'ENABLED' : 'DISABLED'}`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SimulatorController();
