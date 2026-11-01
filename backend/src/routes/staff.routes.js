const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All staff endpoints require active ADMIN authentication
router.use(authenticate, authorize('ADMIN'));

router.get('/', (req, res, next) => staffController.getStaff(req, res, next));
router.get('/:id', (req, res, next) => staffController.getStaffById(req, res, next));
router.post('/', (req, res, next) => staffController.createStaff(req, res, next));
router.put('/:id', (req, res, next) => staffController.updateStaff(req, res, next));
router.patch('/:id/status', (req, res, next) => staffController.updateStatus(req, res, next));

module.exports = router;
