const LocationEvent = require('../models/LocationEvent');

class LocationRepository {
  async findAll(query = {}, limit = 100) {
    return await LocationEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('patientId');
  }

  async findByPatientId(patientId, limit = 100) {
    return await LocationEvent.find({ patientId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('patientId');
  }

  async findLatestByPatientId(patientId) {
    return await LocationEvent.findOne({ patientId })
      .sort({ timestamp: -1 })
      .populate('patientId');
  }

  async findByWardId(wardId, limit = 100) {
    return await LocationEvent.find({ wardId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('patientId');
  }

  async create(locationData) {
    return await LocationEvent.create(locationData);
  }

  async count(query = {}) {
    return await LocationEvent.countDocuments(query);
  }
}

module.exports = new LocationRepository();
