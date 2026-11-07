const auditRepository = require('../repositories/audit.repository');

class AuditService {
  async logAction({ action, staff, targetType, targetId, targetName, details = {} }) {
    try {
      if (!staff || !staff._id) return null;
      return await auditRepository.create({
        action,
        performedBy: staff._id,
        performerName: staff.fullName || 'Staff User',
        performerRole: staff.role || 'ADMIN',
        targetType,
        targetId: targetId ? targetId.toString() : null,
        targetName: targetName || '',
        details,
        timestamp: new Date(),
      });
    } catch (err) {
      console.warn(`[AuditService] Failed to record audit log: ${err.message}`);
      return null;
    }
  }

  async getRecentLogs(query = {}, limit = 100) {
    return await auditRepository.findAll(query, limit);
  }

  async getLogsForTarget(targetType, targetId, limit = 50) {
    return await auditRepository.findByTarget(targetType, targetId, limit);
  }
}

module.exports = new AuditService();

