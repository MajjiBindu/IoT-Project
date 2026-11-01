const SensorEvent = require('../models/SensorEvent');

class EventRepository {
  async create(eventData) {
    return await SensorEvent.create(eventData);
  }

  async findByDeviceAndSequence(deviceId, sequenceNumber) {
    return await SensorEvent.findOne({ deviceId, sequenceNumber });
  }

  async getLatestSequenceForDevice(deviceId) {
    const latest = await SensorEvent.findOne({ deviceId })
      .sort({ sequenceNumber: -1 })
      .select('sequenceNumber');
    return latest && typeof latest.sequenceNumber === 'number' ? latest.sequenceNumber : 0;
  }

  async findRecentByPatient(patientId, limit = 50) {
    return await SensorEvent.find({ patientId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  async findAll(query = {}, limit = 100) {
    return await SensorEvent.find(query)
      .populate('patientId')
      .sort({ timestamp: -1 })
      .limit(limit);
  }
}

module.exports = new EventRepository();
