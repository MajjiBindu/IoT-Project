const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All location routes require authentication
router.use(authenticate);

// View locations & history: ADMIN or NURSE
router.get('/', (req, res, next) => locationController.getLocations(req, res, next));
router.get('/patient/:patientId', (req, res, next) => locationController.getPatientHistory(req, res, next));
router.get('/patient/:patientId/current', (req, res, next) => locationController.getPatientCurrent(req, res, next));
router.get('/ward/:wardId', (req, res, next) => locationController.getWardLocations(req, res, next));

// Record relocation: ADMIN only
router.post('/', authorize('ADMIN'), (req, res, next) => locationController.recordLocation(req, res, next));

module.exports = router;
