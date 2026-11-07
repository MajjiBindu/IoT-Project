const DeviceFault = require('../models/DeviceFault');

class DeviceFaultRepository {
  async create(data) {
    return await DeviceFault.create(data);
  }

  async findActiveByDevice(deviceId) {
    return await DeviceFault.find({ deviceId, recovered: false }).sort({ occurredAt: -1 });
  }

  async findLatestActiveFault(deviceId, faultType) {
    return await DeviceFault.findOne({ deviceId, faultType, recovered: false }).sort({ occurredAt: -1 });
  }

  async markRecovered(faultId, resolutionNotes = 'Auto-recovered') {
    return await DeviceFault.findByIdAndUpdate(
      faultId,
      {
        recovered: true,
        recoveredAt: new Date(),
        resolutionNotes,
      },
      { new: true }
    );
  }

  async markRecoveredByType(deviceId, faultType, resolutionNotes = 'Auto-recovered') {
    return await DeviceFault.updateMany(
      { deviceId, faultType, recovered: false },
      {
        recovered: true,
        recoveredAt: new Date(),
        resolutionNotes,
      }
    );
  }

  async findAll(query = {}, limit = 100) {
    return await DeviceFault.find(query)
      .populate('resolvedBy', 'fullName email')
      .sort({ occurredAt: -1 })
      .limit(limit);
  }
}

module.exports = new DeviceFaultRepository();

