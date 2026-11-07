const auditService = require('../services/audit.service');

class AuditController {
  async getAuditLogs(req, res, next) {
    try {
      const { targetType, targetId, limit } = req.query;
      const query = {};
      if (targetType) query.targetType = targetType;
      if (targetId) query.targetId = targetId;

      const logs = await auditService.getRecentLogs(query, limit ? parseInt(limit, 10) : 100);
      res.json({ success: true, count: logs.length, data: logs });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuditController();

