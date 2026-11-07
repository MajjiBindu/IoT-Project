const mongoose = require('mongoose');
const locationRepository = require('../repositories/location.repository');
const patientRepository = require('../repositories/patient.repository');
const sseManager = require('../sockets/sse.manager');
const auditService = require('./audit.service');

class LocationService {
  /**
   * Record a new patient indoor location event
   */
  async recordLocation(data, staff = null) {
    let { patientId, roomNumber, bedNumber, wardId, floor, status, source, timestamp } = data;

    // 1. Validate patientId
    if (!patientId) {
      const err = new Error('Patient ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      const err = new Error('Invalid Patient ID format');
      err.statusCode = 400;
      throw err;
    }

    const patient = await patientRepository.findById(patientId);
    if (!patient) {
      const err = new Error(`Patient with ID "${patientId}" not found`);
      err.statusCode = 404;
      throw err;
    }

    // 2. Validate roomNumber
    if (!roomNumber || typeof roomNumber !== 'string' || !roomNumber.trim()) {
      const err = new Error('Room number is required and must be a non-empty string');
      err.statusCode = 400;
      throw err;
    }
    roomNumber = roomNumber.trim();

    // 3. Normalize bedNumber, wardId, floor, status, source
    bedNumber = typeof bedNumber === 'string' ? bedNumber.trim() : '';
    wardId = typeof wardId === 'string' && wardId.trim() ? wardId.trim().toUpperCase() : patient.wardId || 'WARD-3B';
    floor = typeof floor === 'string' && floor.trim() ? floor.trim() : patient.floor || 'Floor 3';
    const normalizedStatus = (status || 'LOCATION_UPDATED').toUpperCase().replace(/\s+/g, '_');
    status = ['ASSIGNED', 'LOCATION_UPDATED', 'UNKNOWN', 'NOT_AVAILABLE'].includes(normalizedStatus)
      ? normalizedStatus
      : 'LOCATION_UPDATED';
    const normalizedSource = (source || 'MANUAL').toUpperCase().replace(/\s+/g, '_');
    source = ['MANUAL', 'BLE_BEACON', 'WIFI_TRIANGULATION', 'GPS', 'UWB', 'SENSOR_DERIVED'].includes(normalizedSource)
      ? normalizedSource
      : normalizedSource === 'SENSOR' ? 'SENSOR_DERIVED'
      : normalizedSource === 'BLE' ? 'BLE_BEACON'
      : normalizedSource === 'WIFI' ? 'WIFI_TRIANGULATION'
      : 'MANUAL';

    // 4. Validate timestamp
    let eventTimestamp = new Date();
    if (timestamp) {
      const parsedDate = new Date(timestamp);
      if (isNaN(parsedDate.getTime())) {
        const err = new Error('Invalid timestamp provided');
        err.statusCode = 400;
        throw err;
      }
      eventTimestamp = parsedDate;
    }

    // 5. Prevent unnecessary duplicate location events
    const latestEvent = await locationRepository.findLatestByPatientId(patient._id);
    const isSameAsLatestEvent =
      latestEvent &&
      latestEvent.roomNumber === roomNumber &&
      (latestEvent.bedNumber || '') === bedNumber &&
      (latestEvent.floor || 'Floor 3') === floor;

    const isSameAsPatientCurrent =
      patient.roomNumber === roomNumber &&
      (patient.bedNumber || '') === bedNumber &&
      (patient.floor || 'Floor 3') === floor;

    if (isSameAsLatestEvent || (!latestEvent && isSameAsPatientCurrent)) {
      const err = new Error(
        `Duplicate location event: patient "${patient.name}" is already at ${floor}, Room ${roomNumber}, Bed ${bedNumber || 'N/A'}`
      );
      err.statusCode = 400;
      err.duplicate = true;
      throw err;
    }

    // 6. Persist Location Event
    const locationEvent = await locationRepository.create({
      patientId: patient._id,
      roomNumber,
      bedNumber,
      wardId,
      floor,
      status,
      source,
      updatedBy: staff?._id || null,
      timestamp: eventTimestamp,
    });

    // 7. Update Patient current room/bed/floor and lastLocationUpdate
    const updatedPatient = await patientRepository.updateLocation(patient._id, {
      roomNumber,
      bedNumber,
      wardId,
      floor,
      locationStatus: status,
      locationSource: source,
    });

    // 8. Log administrative action if staff is provided
    if (staff) {
      await auditService.logAction({
        action: 'RELOCATE_PATIENT',
        staff,
        targetType: 'PATIENT',
        targetId: patient._id,
        targetName: patient.name,
        details: {
          previousLocation: `${patient.floor || 'Floor 3'} Rm ${patient.roomNumber} ${patient.bedNumber}`,
          newLocation: `${floor} Rm ${roomNumber} ${bedNumber}`,
          wardId,
          status,
          source,
        },
      });
    }

    // 9. Broadcast location_updated via existing SSE manager
    sseManager.broadcast('location_updated', {
      patientId: patient._id,
      patientName: patient.name,
      roomNumber,
      bedNumber,
      wardId,
      floor,
      status,
      source,
      timestamp: locationEvent.timestamp,
      locationEventId: locationEvent._id,
    });

    // Also notify patient status subscribers for roster synchronization
    sseManager.broadcast('patient_status_updated', {
      patientId: patient._id,
      roomNumber,
      bedNumber,
      wardId,
      floor,
      locationStatus: status,
      locationSource: source,
      lastLocationUpdate: locationEvent.timestamp,
      timestamp: new Date(),
    });

    return {
      locationEvent,
      patient: updatedPatient,
    };
  }

  /**
   * Retrieve location history of a particular patient
   */
  async getPatientHistory(patientId, limit = 100) {
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      const err = new Error('Invalid Patient ID format');
      err.statusCode = 400;
      throw err;
    }

    const patient = await patientRepository.findById(patientId);
    if (!patient) {
      const err = new Error(`Patient with ID "${patientId}" not found`);
      err.statusCode = 404;
      throw err;
    }

    const history = await locationRepository.findByPatientId(patient._id, limit);
    return history;
  }

  /**
   * Retrieve the latest known location of a patient
   */
  async getPatientCurrentLocation(patientId) {
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      const err = new Error('Invalid Patient ID format');
      err.statusCode = 400;
      throw err;
    }

    const patient = await patientRepository.findById(patientId);
    if (!patient) {
      const err = new Error(`Patient with ID "${patientId}" not found`);
      err.statusCode = 404;
      throw err;
    }

    const latest = await locationRepository.findLatestByPatientId(patient._id);
    if (latest) {
      return latest;
    }

    // If no explicit event exists, return patient's baseline room/bed as current location
    return {
      patientId: patient,
      roomNumber: patient.roomNumber,
      bedNumber: patient.bedNumber,
      wardId: patient.wardId || 'WARD-3B',
      timestamp: patient.lastLocationUpdate || patient.updatedAt || new Date(),
      isBaseline: true,
    };
  }

  /**
   * Retrieve location events with filters
   */
  async getLocations(filters = {}) {
    const query = {};
    const limit = filters.limit ? Math.min(500, parseInt(filters.limit, 10)) : 100;

    if (filters.patientId) {
      if (mongoose.Types.ObjectId.isValid(filters.patientId)) {
        query.patientId = filters.patientId;
      }
    }

    if (filters.roomNumber) {
      query.roomNumber = filters.roomNumber;
    }

    if (filters.wardId) {
      query.wardId = filters.wardId.toUpperCase();
    }

    return await locationRepository.findAll(query, limit);
  }

  /**
   * Retrieve patient locations within a specified ward
   */
  async getWardLocations(wardId) {
    if (!wardId || typeof wardId !== 'string') {
      const err = new Error('wardId is required');
      err.statusCode = 400;
      throw err;
    }

    const normalizedWard = wardId.trim().toUpperCase();

    // Query patients in this ward
    const allPatients = await patientRepository.findAll({ status: 'ADMITTED' });
    const wardPatients = allPatients.filter(
      (p) => (p.wardId || 'WARD-3B').toUpperCase() === normalizedWard
    );

    // Map each patient to their current location
    const results = await Promise.all(
      wardPatients.map(async (p) => {
        const latest = await locationRepository.findLatestByPatientId(p._id);
        return {
          patientId: p._id,
          patientName: p.name,
          roomNumber: latest ? latest.roomNumber : p.roomNumber,
          bedNumber: latest ? latest.bedNumber : p.bedNumber,
          wardId: normalizedWard,
          movementStatus: p.movementStatus,
          assignedDeviceId: p.assignedDeviceId,
          lastUpdate: latest ? latest.timestamp : p.lastLocationUpdate || p.updatedAt,
        };
      })
    );

    return {
      wardId: normalizedWard,
      totalPatients: results.length,
      patients: results,
    };
  }
}

module.exports = new LocationService();
