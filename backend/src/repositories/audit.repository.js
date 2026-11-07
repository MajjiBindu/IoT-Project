const AdminAuditLog = require('../models/AdminAuditLog');

class AuditRepository {
  async create(data) {
    return await AdminAuditLog.create(data);
  }

  async findAll(query = {}, limit = 100) {
    return await AdminAuditLog.find(query)
      .populate('performedBy', 'fullName email role')
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async findByTarget(targetType, targetId, limit = 50) {
    return await AdminAuditLog.find({ targetType, targetId })
      .populate('performedBy', 'fullName email role')
      .sort({ timestamp: -1 })
      .limit(limit);
  }
}

module.exports = new AuditRepository();

