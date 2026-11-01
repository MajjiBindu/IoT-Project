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
