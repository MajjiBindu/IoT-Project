const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All patient endpoints require authenticated staff
router.use(authenticate);

// Read-only access: ADMIN or NURSE
router.get('/', (req, res, next) => patientController.getPatients(req, res, next));
router.get('/:id', (req, res, next) => patientController.getPatientById(req, res, next));

// Write access: ADMIN only
router.post('/', authorize('ADMIN'), (req, res, next) => patientController.createPatient(req, res, next));
router.put('/:id', authorize('ADMIN'), (req, res, next) => patientController.updatePatient(req, res, next));
router.patch('/:id/assign-device', authorize('ADMIN'), (req, res, next) => patientController.assignDevice(req, res, next));
router.patch('/:id/unassign-device', authorize('ADMIN'), (req, res, next) => patientController.unassignDevice(req, res, next));

module.exports = router;
