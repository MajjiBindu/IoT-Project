const express = require('express');
const router = express.Router();
const serialController = require('../controllers/serial.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All serial routes require authentication
router.use(authenticate);

// View status: ADMIN or NURSE
router.get('/status', (req, res, next) => serialController.getStatus(req, res, next));

// Trigger reconnect: ADMIN only
router.post('/reconnect', authorize('ADMIN'), (req, res, next) => serialController.reconnect(req, res, next));

module.exports = router;
