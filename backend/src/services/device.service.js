const mongoose = require('mongoose');
const deviceRepository = require('../repositories/device.repository');
const patientRepository = require('../repositories/patient.repository');
const sseManager = require('../sockets/sse.manager');

const VALID_STATUSES = ['ACTIVE', 'OFFLINE', 'SIMULATING'];

class DeviceService {
  /**
   * Retrieve all registered devices
   */
  async getAllDevices(query = {}) {
    const devices = await deviceRepository.findAll(query);
    return devices;
  }

  /**
   * Calculate summary metrics across all devices
   */
  async getOverview() {
    const devices = await deviceRepository.findAll();
    const total = devices.length;
    let active = 0;
    let offline = 0;
    let simulating = 0;
    let lowBattery = 0;

    for (const d of devices) {
      if (d.status === 'ACTIVE') active += 1;
      else if (d.status === 'OFFLINE') offline += 1;
      else if (d.status === 'SIMULATING') simulating += 1;

      if (typeof d.batteryLevel === 'number' && d.batteryLevel < 20) {
        lowBattery += 1;
      }
    }

    return { total, active, offline, simulating, lowBattery };
  }

  /**
   * Retrieve single device by ID or deviceCode
   */
  async getDeviceById(idOrCode) {
    const device = await deviceRepository.findByIdOrCode(idOrCode);
    return device;
  }

  /**
   * Register a new device with strict validation
   */
  async registerDevice(data) {
    let { deviceCode, status, batteryLevel } = data;

    // 1. Validate deviceCode
    if (!deviceCode || typeof deviceCode !== 'string' || !deviceCode.trim()) {
      const err = new Error('Device code is required and must be a non-empty string');
      err.statusCode = 400;
      throw err;
    }
    deviceCode = deviceCode.trim().toUpperCase();

    // Check uniqueness
    const existing = await deviceRepository.findByCode(deviceCode);
    if (existing) {
      const err = new Error(`Device code "${deviceCode}" is already registered`);
      err.statusCode = 409;
      throw err;
    }

    // 2. Validate status
    if (status !== undefined && status !== null) {
      if (!VALID_STATUSES.includes(status)) {
        const err = new Error(`Invalid status "${status}". Allowed values: ${VALID_STATUSES.join(', ')}`);
        err.statusCode = 400;
        throw err;
      }
    } else {
      status = 'ACTIVE';
    }

    // 3. Validate batteryLevel
    if (batteryLevel !== undefined && batteryLevel !== null) {
      const parsedBattery = Number(batteryLevel);
      if (isNaN(parsedBattery) || parsedBattery < 0 || parsedBattery > 100) {
        const err = new Error('Battery percentage must be a number between 0 and 100');
        err.statusCode = 400;
        throw err;
      }
      batteryLevel = Math.round(parsedBattery);
    } else {
      batteryLevel = 98;
    }

    const device = await deviceRepository.create({
      deviceCode,
      status,
      batteryLevel,
      assignedPatientId: null,
      lastHeartbeat: new Date(),
    });

    // Broadcast device update
    sseManager.broadcast('device_updated', {
      action: 'REGISTERED',
      device,
      timestamp: new Date(),
    });

    return device;
  }

  /**
   * Update device information (status, batteryLevel)
   */
  async updateDevice(idOrCode, updateData) {
    const device = await deviceRepository.findByIdOrCode(idOrCode);
    if (!device) {
      const err = new Error('Device not found');
      err.statusCode = 404;
      throw err;
    }

    const payload = {};

    if (updateData.status !== undefined) {
      if (!VALID_STATUSES.includes(updateData.status)) {
        const err = new Error(`Invalid status "${updateData.status}". Allowed values: ${VALID_STATUSES.join(', ')}`);
        err.statusCode = 400;
        throw err;
      }
      payload.status = updateData.status;
    }

    if (updateData.batteryLevel !== undefined) {
      const parsed = Number(updateData.batteryLevel);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        const err = new Error('Battery percentage must be a number between 0 and 100');
        err.statusCode = 400;
        throw err;
      }
      payload.batteryLevel = Math.round(parsed);
    }

    if (updateData.lastHeartbeat !== undefined) {
      payload.lastHeartbeat = new Date(updateData.lastHeartbeat);
    }

    const updated = await deviceRepository.update(device._id, payload);

    sseManager.broadcast('device_updated', {
      action: 'UPDATED',
      device: updated,
      timestamp: new Date(),
    });

    return updated;
  }

  /**
   * Associate a device with a patient with mutual exclusion validations:
   * - One device cannot be assigned to multiple patients.
   * - One patient cannot have multiple devices.
   */
  async assignDevice(deviceIdOrCode, patientId) {
    // 1. Lookup Device
    const device = await deviceRepository.findByIdOrCode(deviceIdOrCode);
    if (!device) {
      const err = new Error('Device not found');
      err.statusCode = 404;
      throw err;
    }

    // 2. Lookup Patient
    const patient = await patientRepository.findById(patientId);
    if (!patient) {
      const err = new Error('Patient not found');
      err.statusCode = 404;
      throw err;
    }

    // 3. Validation: Prevent assigning one device to multiple patients
    if (device.assignedPatientId) {
      const currentPatientId = device.assignedPatientId._id
        ? device.assignedPatientId._id.toString()
        : device.assignedPatientId.toString();

      if (currentPatientId !== patient._id.toString()) {
        const assignedName = device.assignedPatientId.name || 'another patient';
        const err = new Error(
          `Device "${device.deviceCode}" is already assigned to ${assignedName}. Unassign it first.`
        );
        err.statusCode = 400;
        throw err;
      }
    }

    // 4. Validation: Prevent assigning multiple devices to one patient
    if (patient.assignedDeviceId && patient.assignedDeviceId !== device.deviceCode) {
      const err = new Error(
        `Patient "${patient.name}" already has an assigned device (${patient.assignedDeviceId}). Unassign it first.`
      );
      err.statusCode = 400;
      throw err;
    }

    // 5. Update Device
    const updatedDevice = await deviceRepository.assignToPatient(device._id, patient._id);

    // 6. Update Patient
    const updatedPatient = await patientRepository.assignDevice(patient._id, device.deviceCode);

    // 7. Broadcast updates over SSE
    sseManager.broadcast('device_updated', {
      action: 'ASSIGNED',
      device: updatedDevice,
      patientId: patient._id,
      timestamp: new Date(),
    });

    sseManager.broadcast('patient_status_updated', {
      patientId: patient._id,
      assignedDeviceId: device.deviceCode,
      lastMovementUpdate: updatedPatient.lastMovementUpdate || new Date(),
      timestamp: new Date(),
    });

    return { device: updatedDevice, patient: updatedPatient };
  }

  /**
   * Unassign device from patient
   */
  async unassignDevice(deviceIdOrCode) {
    const device = await deviceRepository.findByIdOrCode(deviceIdOrCode);
    if (!device) {
      const err = new Error('Device not found');
      err.statusCode = 404;
      throw err;
    }

    let affectedPatientId = null;

    if (device.assignedPatientId) {
      affectedPatientId = device.assignedPatientId._id
        ? device.assignedPatientId._id.toString()
        : device.assignedPatientId.toString();

      if (mongoose.Types.ObjectId.isValid(affectedPatientId)) {
        await patientRepository.unassignDevice(affectedPatientId);
      }
    }

    // Ensure any patient assigned this deviceCode is unassigned
    try {
      await patientRepository.unassignByDeviceCode(device.deviceCode);
    } catch {
      // Non-blocking in case of isolated unit testing
    }

    const updatedDevice = await deviceRepository.unassign(device._id);

    // Broadcast SSE updates
    sseManager.broadcast('device_updated', {
      action: 'UNASSIGNED',
      device: updatedDevice,
      timestamp: new Date(),
    });

    if (affectedPatientId) {
      sseManager.broadcast('patient_status_updated', {
        patientId: affectedPatientId,
        assignedDeviceId: null,
        timestamp: new Date(),
      });
    }

    return { device: updatedDevice };
  }
}

module.exports = new DeviceService();
