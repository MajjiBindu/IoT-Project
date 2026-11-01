const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alert.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All alert routes require authentication
router.use(authenticate);

// View alerts: ADMIN or NURSE
router.get('/', (req, res, next) => alertController.getAlerts(req, res, next));
router.get('/active', (req, res, next) => alertController.getActiveAlerts(req, res, next));

// Acknowledge & Resolve alerts: ADMIN or NURSE
router.patch('/:id/acknowledge', authorize('ADMIN', 'NURSE'), (req, res, next) =>
  alertController.acknowledgeAlert(req, res, next)
);
router.patch('/:id/resolve', authorize('ADMIN', 'NURSE'), (req, res, next) =>
  alertController.resolveAlert(req, res, next)
);

module.exports = router;
