const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Audit logs require active ADMIN authentication
router.use(authenticate, authorize('ADMIN'));

router.get('/', (req, res, next) => auditController.getAuditLogs(req, res, next));

module.exports = router;

