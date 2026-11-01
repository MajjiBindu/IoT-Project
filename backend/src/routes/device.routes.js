const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/device.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All device routes require authentication
router.use(authenticate);

// Read-only: ADMIN or NURSE
router.get('/', (req, res, next) => deviceController.getDevices(req, res, next));
router.get('/overview', (req, res, next) => deviceController.getOverview(req, res, next));
router.get('/:id', (req, res, next) => deviceController.getDeviceById(req, res, next));

// Device registration, management, and pairing: ADMIN only
router.post('/', authorize('ADMIN'), (req, res, next) => deviceController.registerDevice(req, res, next));
router.patch('/:id', authorize('ADMIN'), (req, res, next) => deviceController.updateDevice(req, res, next));
router.put('/:id', authorize('ADMIN'), (req, res, next) => deviceController.updateDevice(req, res, next));
router.patch('/:id/assign', authorize('ADMIN'), (req, res, next) => deviceController.assignDevice(req, res, next));
router.patch('/:id/unassign', authorize('ADMIN'), (req, res, next) => deviceController.unassignDevice(req, res, next));

module.exports = router;
