const mongoose = require('mongoose');
const Device = require('../models/Device');

class DeviceRepository {
  async findAll(query = {}) {
    return await Device.find(query)
      .populate('assignedPatientId')
      .sort({ deviceCode: 1 });
  }

  async findById(id) {
    return await Device.findById(id).populate('assignedPatientId');
  }

  async findByCode(deviceCode) {
    return await Device.findOne({ deviceCode }).populate('assignedPatientId');
  }

  async findByIdOrCode(idOrCode) {
    if (mongoose.Types.ObjectId.isValid(idOrCode)) {
      const byId = await Device.findById(idOrCode).populate('assignedPatientId');
      if (byId) return byId;
    }
    return await Device.findOne({ deviceCode: idOrCode }).populate('assignedPatientId');
  }

  async create(deviceData) {
    return await Device.create(deviceData);
  }

  async update(id, updateData) {
    return await Device.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('assignedPatientId');
  }

  async updateHeartbeat(deviceCode, extraData = {}) {
    return await Device.findOneAndUpdate(
      { deviceCode },
      { lastHeartbeat: new Date(), ...extraData },
      { new: true }
    );
  }

  async assignToPatient(deviceId, patientId) {
    return await Device.findByIdAndUpdate(
      deviceId,
      { assignedPatientId: patientId },
      { new: true, runValidators: true }
    ).populate('assignedPatientId');
  }

  async unassign(deviceId) {
    return await Device.findByIdAndUpdate(
      deviceId,
      { assignedPatientId: null },
      { new: true, runValidators: true }
    ).populate('assignedPatientId');
  }

  async count(query = {}) {
    return await Device.countDocuments(query);
  }
}

module.exports = new DeviceRepository();
