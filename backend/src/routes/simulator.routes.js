const express = require('express');
const router = express.Router();
const simulatorController = require('../controllers/simulator.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All simulator routes require authentication
router.use(authenticate);

// View status: ADMIN or NURSE
router.get('/status', (req, res) => simulatorController.getStatus(req, res));

// Simulation controls: ADMIN only
router.post('/walk', authorize('ADMIN'), (req, res, next) => simulatorController.simulateWalk(req, res, next));
router.post('/stand', authorize('ADMIN'), (req, res, next) => simulatorController.simulateStand(req, res, next));
router.post('/sit', authorize('ADMIN'), (req, res, next) => simulatorController.simulateSit(req, res, next));
router.post('/sudden-movement', authorize('ADMIN'), (req, res, next) => simulatorController.simulateSuddenMovement(req, res, next));
router.post('/inactivity', authorize('ADMIN'), (req, res, next) => simulatorController.simulateInactivity(req, res, next));
router.post('/free-fall', authorize('ADMIN'), (req, res, next) => simulatorController.simulateFreeFall(req, res, next));
router.post('/impact', authorize('ADMIN'), (req, res, next) => simulatorController.simulateImpact(req, res, next));
router.post('/impact-only', authorize('ADMIN'), (req, res, next) => simulatorController.simulateImpactOnly(req, res, next));
router.post('/orientation-change', authorize('ADMIN'), (req, res, next) => simulatorController.simulateOrientationChange(req, res, next));
router.post('/post-impact-inactivity', authorize('ADMIN'), (req, res, next) => simulatorController.simulatePostImpactInactivity(req, res, next));
router.post('/complete-fall', authorize('ADMIN'), (req, res, next) => simulatorController.simulateCompleteFall(req, res, next));
router.post('/fall-and-recover', authorize('ADMIN'), (req, res, next) => simulatorController.simulateFallAndRecover(req, res, next));
router.post('/fall', authorize('ADMIN'), (req, res, next) => simulatorController.simulateFall(req, res, next));
router.post('/auto-loop/toggle', authorize('ADMIN'), (req, res, next) => simulatorController.toggleAutoLoop(req, res, next));

// Hardware Fault Simulation routes: ADMIN only
router.post('/fault/disconnect', authorize('ADMIN'), (req, res, next) => simulatorController.simulateSensorDisconnection(req, res, next));
router.post('/fault/abnormal-values', authorize('ADMIN'), (req, res, next) => simulatorController.simulateAbnormalValues(req, res, next));
router.post('/fault/comm-interruption', authorize('ADMIN'), (req, res, next) => simulatorController.simulateCommInterruption(req, res, next));
router.post('/fault/recover', authorize('ADMIN'), (req, res, next) => simulatorController.simulateFaultRecovery(req, res, next));

module.exports = router;
