const patientRepository = require('../repositories/patient.repository');
const deviceService = require('../services/device.service');
const auditService = require('../services/audit.service');
const sseManager = require('../sockets/sse.manager');

class PatientController {
  /**
   * GET /api/patients
   * Retrieve list of patients with search, filtering, and role-based permissions
   */
  async getPatients(req, res, next) {
    try {
      const {
        status,
        wardId,
        ward,
        movementStatus,
        movement,
        fallRiskLevel,
        risk,
        assignedNurseId,
        nurseId,
        nurse,
        myOnly,
        search,
      } = req.query;

      const query = {};

      if (status && status !== 'ALL') query.status = status;

      const targetWard = wardId || ward;
      if (targetWard && targetWard !== 'ALL') query.wardId = targetWard;

      const targetMovement = movementStatus || movement;
      if (targetMovement && targetMovement !== 'ALL') query.movementStatus = targetMovement;

      const targetRisk = fallRiskLevel || risk;
      if (targetRisk && targetRisk !== 'ALL') query.fallRiskLevel = targetRisk;

      const targetNurse = assignedNurseId || nurseId || nurse;
      if (targetNurse && targetNurse !== 'ALL') {
        query.assignedNurseId = targetNurse;
      } else if (req.staff?.role === 'NURSE' && (myOnly === 'true' || myOnly === true)) {
        query.assignedNurseId = req.staff._id;
      }

      let patients = await patientRepository.findAll(query);

      // Search by patient name or ID
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        patients = patients.filter(
          (p) =>
            p.name?.toLowerCase().includes(term) ||
            p._id.toString().toLowerCase().includes(term) ||
            p.roomNumber?.toLowerCase().includes(term) ||
            p.assignedDeviceId?.toLowerCase().includes(term)
        );
      }

      res.json({ success: true, count: patients.length, data: patients });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/patients/:id
   * Retrieve single patient with authorization check
   */
  async getPatientById(req, res, next) {
    try {
      const patient = await patientRepository.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      // Role check: If nurse is restricted to assigned patients only
      if (req.staff?.role === 'NURSE' && req.query.strictAssigned === 'true') {
        const assignedId = patient.assignedNurseId?._id?.toString() || patient.assignedNurseId?.toString();
        if (assignedId && assignedId !== req.staff._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access restricted: Patient is assigned to another caregiver.',
          });
        }
      }

      res.json({ success: true, data: patient });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/patients
   * Register a new patient (ADMIN only)
   */
  async createPatient(req, res, next) {
    try {
      const {
        name,
        roomNumber,
        bedNumber,
        floor,
        wardId,
        age,
        gender,
        fallRiskLevel,
        assignedNurseId,
        notes,
        assignedDeviceId,
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Patient name is required' });
      }
      if (!roomNumber || !roomNumber.trim()) {
        return res.status(400).json({ success: false, message: 'Room number is required' });
      }
      if (!bedNumber || !bedNumber.trim()) {
        return res.status(400).json({ success: false, message: 'Bed number is required' });
      }

      const patient = await patientRepository.create({
        name: name.trim(),
        roomNumber: roomNumber.trim(),
        bedNumber: bedNumber.trim(),
        floor: floor ? floor.trim() : 'Floor 3',
        wardId: wardId ? wardId.trim() : 'WARD-3B',
        age: age ? parseInt(age, 10) : 65,
        gender: gender || 'NOT_SPECIFIED',
        fallRiskLevel: fallRiskLevel || 'MEDIUM',
        assignedNurseId: assignedNurseId || null,
        notes: notes || '',
        assignedDeviceId: null,
        status: 'ADMITTED',
        synthetic: false,
      });

      // Auto-assign device if requested
      if (assignedDeviceId) {
        try {
          await deviceService.assignDevice(assignedDeviceId, patient._id);
        } catch (assignErr) {
          console.warn(`[PatientController] Could not auto-assign device ${assignedDeviceId}: ${assignErr.message}`);
        }
      }

      const reloaded = await patientRepository.findById(patient._id);

      // Audit log
      await auditService.logAction({
        action: 'REGISTER_PATIENT',
        staff: req.staff,
        targetType: 'PATIENT',
        targetId: patient._id,
        targetName: patient.name,
        details: {
          roomNumber,
          bedNumber,
          wardId: reloaded.wardId,
          fallRiskLevel: reloaded.fallRiskLevel,
          assignedDeviceId: reloaded.assignedDeviceId,
        },
      });

      // Broadcast new patient via SSE
      sseManager.broadcast('patient_status_updated', {
        action: 'REGISTERED',
        patientId: patient._id,
        patient: reloaded,
        timestamp: new Date(),
      });

      res.status(201).json({ success: true, data: reloaded });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/patients/:id
   * Edit patient information (ADMIN only)
   */
  async updatePatient(req, res, next) {
    try {
      const allowedFields = [
        'name',
        'roomNumber',
        'bedNumber',
        'floor',
        'wardId',
        'age',
        'gender',
        'fallRiskLevel',
        'assignedNurseId',
        'notes',
        'status',
      ];

      const updateData = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const updated = await patientRepository.update(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      await auditService.logAction({
        action: 'UPDATE_PATIENT',
        staff: req.staff,
        targetType: 'PATIENT',
        targetId: updated._id,
        targetName: updated.name,
        details: updateData,
      });

      sseManager.broadcast('patient_status_updated', {
        action: 'UPDATED',
        patientId: updated._id,
        patient: updated,
        timestamp: new Date(),
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/patients/:id/assign-nurse
   * Assign or reassign a nurse to a patient (ADMIN only)
   */
  async assignNurse(req, res, next) {
    try {
      const { nurseId } = req.body;
      const patient = await patientRepository.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      const updated = await patientRepository.assignNurse(req.params.id, nurseId);

      await auditService.logAction({
        action: 'ASSIGN_NURSE',
        staff: req.staff,
        targetType: 'PATIENT',
        targetId: updated._id,
        targetName: updated.name,
        details: {
          nurseId,
          nurseName: updated.assignedNurseId?.fullName || 'Unassigned',
        },
      });

      sseManager.broadcast('patient_status_updated', {
        action: 'NURSE_ASSIGNED',
        patientId: updated._id,
        assignedNurseId: updated.assignedNurseId,
        timestamp: new Date(),
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/patients/:id/discharge
   * Discharge patient from ward (ADMIN only)
   */
  async dischargePatient(req, res, next) {
    try {
      const patient = await patientRepository.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      // Unassign device if currently held
      if (patient.assignedDeviceId) {
        try {
          await deviceService.unassignDevice(patient.assignedDeviceId);
        } catch (uErr) {
          console.warn(`[PatientController] Unassign device note on discharge: ${uErr.message}`);
        }
      }

      const discharged = await patientRepository.discharge(req.params.id);

      await auditService.logAction({
        action: 'DISCHARGE_PATIENT',
        staff: req.staff,
        targetType: 'PATIENT',
        targetId: discharged._id,
        targetName: discharged.name,
        details: { dischargedAt: new Date() },
      });

      sseManager.broadcast('patient_status_updated', {
        action: 'DISCHARGED',
        patientId: discharged._id,
        status: 'DISCHARGED',
        assignedDeviceId: null,
        timestamp: new Date(),
      });

      res.json({ success: true, message: 'Patient discharged successfully', data: discharged });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/patients/:id/assign-device
   */
  async assignDevice(req, res, next) {
    try {
      const { deviceId } = req.body;
      if (!deviceId) {
        return res.status(400).json({ success: false, message: 'deviceId is required in body' });
      }
      const result = await deviceService.assignDevice(deviceId, req.params.id);

      await auditService.logAction({
        action: 'ASSIGN_DEVICE',
        staff: req.staff,
        targetType: 'PATIENT',
        targetId: result.patient._id,
        targetName: result.patient.name,
        details: { deviceId },
      });

      res.json({ success: true, data: result.patient, device: result.device });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  /**
   * PATCH /api/patients/:id/unassign-device
   */
  async unassignDevice(req, res, next) {
    try {
      const patient = await patientRepository.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      const deviceCode = patient.assignedDeviceId;
      if (deviceCode) {
        await deviceService.unassignDevice(deviceCode);
      }
      const updated = await patientRepository.findById(req.params.id);

      await auditService.logAction({
        action: 'UNASSIGN_DEVICE',
        staff: req.staff,
        targetType: 'PATIENT',
        targetId: updated._id,
        targetName: updated.name,
        details: { deviceCode },
      });

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
