const patientRepository = require('../repositories/patient.repository');
const deviceService = require('../services/device.service');

class PatientController {
  async getPatients(req, res, next) {
    try {
      const { status } = req.query;
      const query = status ? { status } : {};
      const patients = await patientRepository.findAll(query);
      res.json({ success: true, data: patients });
    } catch (err) {
      next(err);
    }
  }

  async getPatientById(req, res, next) {
    try {
      const patient = await patientRepository.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      res.json({ success: true, data: patient });
    } catch (err) {
      next(err);
    }
  }

  async createPatient(req, res, next) {
    try {
      const { name, roomNumber, bedNumber, notes, assignedDeviceId } = req.body;
      const patient = await patientRepository.create({
        name,
        roomNumber,
        bedNumber,
        notes,
        assignedDeviceId: null,
        synthetic: true,
      });

      if (assignedDeviceId) {
        try {
          await deviceService.assignDevice(assignedDeviceId, patient._id);
          const reloaded = await patientRepository.findById(patient._id);
          return res.status(201).json({ success: true, data: reloaded });
        } catch (assignErr) {
          console.warn(`[PatientController] Could not auto-assign device ${assignedDeviceId}: ${assignErr.message}`);
        }
      }

      res.status(201).json({ success: true, data: patient });
    } catch (err) {
      next(err);
    }
  }

  async updatePatient(req, res, next) {
    try {
      const updated = await patientRepository.update(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async assignDevice(req, res, next) {
    try {
      const { deviceId } = req.body;
      if (!deviceId) {
        return res.status(400).json({ success: false, message: 'deviceId is required in body' });
      }
      const result = await deviceService.assignDevice(deviceId, req.params.id);
      res.json({ success: true, data: result.patient, device: result.device });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async unassignDevice(req, res, next) {
    try {
      const patient = await patientRepository.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      if (patient.assignedDeviceId) {
        await deviceService.unassignDevice(patient.assignedDeviceId);
      }
      const updated = await patientRepository.findById(req.params.id);
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
}

module.exports = new PatientController();
