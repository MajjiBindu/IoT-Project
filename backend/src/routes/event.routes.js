const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const { authenticate } = require('../middleware/auth');

// Protected SSE Stream - only authenticated staff can subscribe
router.get('/stream', authenticate, (req, res) => eventController.streamEvents(req, res));

// Protected telemetry history
router.get('/history', authenticate, (req, res, next) => eventController.getHistory(req, res, next));
router.get('/unified-history', authenticate, (req, res, next) => eventController.getUnifiedHistory(req, res, next));

// Telemetry ingestion endpoint
router.post('/', (req, res, next) => eventController.ingestEvent(req, res, next));

module.exports = router;
