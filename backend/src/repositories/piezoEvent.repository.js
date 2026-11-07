const PiezoEvent = require('../models/PiezoEvent');

class PiezoEventRepository {
  async create(data) {
    return await PiezoEvent.create(data);
  }

  async findByDeviceAndSequence(deviceId, sequenceNumber) {
    return await PiezoEvent.findOne({ deviceId, sequenceNumber });
  }

  async getLatestSequenceForDevice(deviceId) {
    const latest = await PiezoEvent.findOne({ deviceId })
      .sort({ sequenceNumber: -1 })
      .select('sequenceNumber');
    return latest && typeof latest.sequenceNumber === 'number' ? latest.sequenceNumber : -1;
  }

  async getLatestForDevice(deviceId) {
    return await PiezoEvent.findOne({ deviceId })
      .sort({ sequenceNumber: -1 });
  }

  async getLatestMovementForDevice(deviceId) {
    return await PiezoEvent.findOne({
      deviceId,
      event: 'MOVEMENT',
      status: 'ACTIVE',
    }).sort({ timestamp: -1 });
  }

  async findRecentByPatient(patientId, limit = 50) {
    return await PiezoEvent.find({ patientId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async findRecent(query = {}, limit = 100) {
    return await PiezoEvent.find(query)
      .populate('patientId')
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async count(query = {}) {
    return await PiezoEvent.countDocuments(query);
  }
}

module.exports = new PiezoEventRepository();
