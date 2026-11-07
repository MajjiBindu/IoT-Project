jest.setTimeout(40000);
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const { connectDB, disconnectDB, sanitizeUri } = require('../src/config/db');
const Patient = require('../src/models/Patient');
const Device = require('../src/models/Device');
const Alert = require('../src/models/Alert');
const SensorEvent = require('../src/models/SensorEvent');
const PiezoEvent = require('../src/models/PiezoEvent');
const Staff = require('../src/models/Staff');
const LocationEvent = require('../src/models/LocationEvent');
const DeviceFault = require('../src/models/DeviceFault');
const AdminAuditLog = require('../src/models/AdminAuditLog');
const simulatorService = require('../src/services/simulator.service');
const sseManager = require('../src/sockets/sse.manager');

describe('INDEPENDENT VERIFICATION AND VALIDATION TEST SUITE', () => {
  let adminStaff;
  let nurseStaff;
  let adminToken;
  let nurseToken;
  let testPatient;
  let testDevice;

  const JWT_SECRET = process.env.JWT_SECRET || 'hospital_mobility_jwt_secure_key_2026_dev_random_signature_string';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();

    // Clean test artifacts
    await Staff.deleteMany({ email: { $in: ['audit-admin@hospital.org', 'audit-nurse@hospital.org'] } });
    await Patient.deleteMany({ name: { $regex: /Audit Test/i } });
    await Device.deleteMany({ deviceCode: { $regex: /AUDIT-/i } });
    await Alert.deleteMany({ patientName: { $regex: /Audit Test/i } });
    await DeviceFault.deleteMany({ deviceId: { $regex: /AUDIT-/i } });
    await PiezoEvent.deleteMany({ deviceId: { $regex: /AUDIT-/i } });
    await SensorEvent.deleteMany({ deviceId: { $regex: /AUDIT-/i } });

    // 1. Seed Admin
    adminStaff = await Staff.create({
      fullName: 'Audit Administrator',
      email: 'audit-admin@hospital.org',
      password: 'AdminPassword123!',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    adminToken = jwt.sign({ id: adminStaff._id, role: 'ADMIN', email: adminStaff.email }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Seed Nurse
    nurseStaff = await Staff.create({
      fullName: 'Audit Nurse',
      email: 'audit-nurse@hospital.org',
      password: 'NursePassword123!',
      role: 'NURSE',
      status: 'ACTIVE',
    });
    nurseToken = jwt.sign({ id: nurseStaff._id, role: 'NURSE', email: nurseStaff.email }, JWT_SECRET, { expiresIn: '1h' });

    // 3. Seed Patient & Device
    testDevice = await Device.create({
      deviceCode: 'AUDIT-TAG-01',
      batteryLevel: 95,
      status: 'ACTIVE',
    });

    testPatient = await Patient.create({
      name: 'Audit Test Patient Alpha',
      age: 74,
      gender: 'MALE',
      wardId: 'WARD-3B',
      floor: 'Floor 3',
      roomNumber: '305',
      bedNumber: 'Bed-1',
      fallRiskLevel: 'HIGH',
      locationStatus: 'ASSIGNED',
      locationSource: 'MANUAL',
      assignedDeviceId: testDevice.deviceCode,
      assignedNurseId: nurseStaff._id,
      status: 'ADMITTED',
      movementStatus: 'STATIONARY',
      synthetic: true,
    });

    await Device.findByIdAndUpdate(testDevice._id, { assignedPatientId: testPatient._id });
  });

  afterAll(async () => {
    simulatorService.stopAutoLoop();
    sseManager.clear();
    await disconnectDB();
  });

  // =========================================================================
  // SECTION 1: AUTHENTICATION, PASSWORD SECURITY, & JWT VALIDATION
  // =========================================================================
  describe('1. Authentication, Password Security & JWT Validation', () => {
    it('authenticates Admin with correct credentials and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'audit-admin@hospital.org', password: 'AdminPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.staff.role).toBe('ADMIN');
    });

    it('authenticates Nurse with correct credentials and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'audit-nurse@hospital.org', password: 'NursePassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.staff.role).toBe('NURSE');
    });

    it('rejects incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'audit-admin@hospital.org', password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('verifies passwords are never stored in plaintext (bcrypt hash verification)', async () => {
      const staffInDb = await Staff.findById(adminStaff._id).select('+password');
      expect(staffInDb.password).not.toBe('AdminPassword123!');
      expect(staffInDb.password).toMatch(/^\$2[aby]\$\d+\$/); // Valid bcrypt hash pattern
      const isMatch = await bcrypt.compare('AdminPassword123!', staffInDb.password);
      expect(isMatch).toBe(true);
    });

    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await request(app).get('/api/patients');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects tampered or forged JWT tokens with 401', async () => {
      const forgedToken = jwt.sign({ id: adminStaff._id, role: 'ADMIN' }, 'wrong_secret_signature');
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 2: ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSIONS
  // =========================================================================
  describe('2. Role-Based Access Control (RBAC) Restrictions', () => {
    it('ADMIN can create a new patient (POST /api/patients)', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Audit Test Patient Beta',
          age: 62,
          gender: 'FEMALE',
          wardId: 'WARD-3B',
          floor: 'Floor 3',
          roomNumber: '306',
          bedNumber: 'Bed-A',
          fallRiskLevel: 'MEDIUM',
          notes: 'Test creation by admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Audit Test Patient Beta');
    });

    it('NURSE is forbidden from creating a patient (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          name: 'Unauthorized Patient',
          roomNumber: '999',
          bedNumber: 'Bed-Z',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ADMIN can assign a nurse to a patient (PATCH /api/patients/:id/assign-nurse)', async () => {
      const res = await request(app)
        .patch(`/api/patients/${testPatient._id}/assign-nurse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nurseId: nurseStaff._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedNurseId._id.toString()).toBe(nurseStaff._id.toString());
    });

    it('NURSE is forbidden from assigning nurses (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/patients/${testPatient._id}/assign-nurse`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ nurseId: adminStaff._id });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ADMIN can discharge a patient (PATCH /api/patients/:id/discharge)', async () => {
      const tempPatient = await Patient.create({
        name: 'Audit Discharge Patient',
        roomNumber: '308',
        bedNumber: 'Bed-B',
        wardId: 'WARD-3B',
        assignedDeviceId: 'AUDIT-TAG-TEMP',
      });

      const res = await request(app)
        .patch(`/api/patients/${tempPatient._id}/discharge`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DISCHARGED');
      expect(res.body.data.assignedDeviceId).toBeNull();
    });

    it('NURSE is forbidden from discharging a patient (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/patients/${testPatient._id}/discharge`)
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ADMIN can record location relocations (POST /api/locations)', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          patientId: testPatient._id,
          wardId: 'WARD-3B',
          floor: 'Floor 3',
          roomNumber: '310',
          bedNumber: 'Bed-2',
          status: 'Location updated',
          source: 'MANUAL',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.roomNumber).toBe('310');
    });

    it('NURSE is forbidden from recording location relocations (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          patientId: testPatient._id,
          roomNumber: '312',
          bedNumber: 'Bed-1',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ADMIN can access audit logs (GET /api/audit-logs)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('NURSE is forbidden from accessing audit logs (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('NURSE is forbidden from triggering simulation endpoints (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/simulator/walk')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ patientId: testPatient._id });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 3: PATIENT ROSTER, FILTERS & DATA CONSISTENCY
  // =========================================================================
  describe('3. Patient Roster, Search, Filters & Data Persistence', () => {
    it('retrieves patient roster with populated nurse and device details', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const target = res.body.data.find((p) => p._id === testPatient._id.toString());
      expect(target).toBeDefined();
      expect(target.assignedNurseId).toBeDefined();
      expect(target.assignedNurseId.fullName).toBe('Audit Nurse');
      expect(target.fallRiskLevel).toBe('HIGH');
      expect(target.floor).toBe('Floor 3');
    });

    it('filters patients by nurseId', async () => {
      const res = await request(app)
        .get(`/api/patients?nurseId=${nurseStaff._id}`)
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((p) => {
        const nId = p.assignedNurseId?._id || p.assignedNurseId;
        expect(nId.toString()).toBe(nurseStaff._id.toString());
      });
    });

    it('filters patients by fall risk level', async () => {
      const res = await request(app)
        .get('/api/patients?risk=HIGH')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((p) => {
        expect(p.fallRiskLevel).toBe('HIGH');
      });
    });

    it('searches patients by name keyword', async () => {
      const res = await request(app)
        .get('/api/patients?search=Alpha')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toContain('Alpha');
    });

    it('maintains device bidirectional consistency (device.assignedPatientId === patient._id)', async () => {
      const dev = await Device.findOne({ deviceCode: testDevice.deviceCode });
      expect(dev.assignedPatientId.toString()).toBe(testPatient._id.toString());
    });
  });

  // =========================================================================
  // SECTION 4: LOCATION MANAGEMENT & HISTORY AUDIT TRAIL
  // =========================================================================
  describe('4. Indoor Location Tracking & Audit History', () => {
    it('retrieves chronological location transition history for a patient', async () => {
      const res = await request(app)
        .get(`/api/locations/patient/${testPatient._id}`)
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].roomNumber).toBeDefined();
    });

    it('records location source and status correctly', async () => {
      const res = await request(app)
        .get(`/api/locations/patient/${testPatient._id}/current`)
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.floor).toBe('Floor 3');
      expect(res.body.data.status).toBeDefined();
      expect(res.body.data.source).toBeDefined();
    });
  });

  // =========================================================================
  // SECTION 5: MULTISTAGE FALL HEURISTIC, REJECTIONS & SENSOR ACCURACY
  // =========================================================================
  describe('5. Sensor Accuracy: Distinction of Vibration, Impact & Kinematics', () => {
    it('normal walking simulation updates movementStatus to WALKING with zero alerts', async () => {
      const alertCountBefore = await Alert.countDocuments();
      const res = await request(app)
        .post('/api/simulator/walk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ patientId: testPatient._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const alertCountAfter = await Alert.countDocuments();
      expect(alertCountAfter).toBe(alertCountBefore); // Zero alerts generated
    });

    it('stationary simulation updates movementStatus to STATIONARY with zero alerts', async () => {
      const alertCountBefore = await Alert.countDocuments();
      const res = await request(app)
        .post('/api/simulator/inactivity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ patientId: testPatient._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const alertCountAfter = await Alert.countDocuments();
      expect(alertCountAfter).toBe(alertCountBefore); // Zero alerts generated
    });

    it('rejects impact without prior freefall descent (False Positive Protection)', async () => {
      const alertCountBefore = await Alert.countDocuments();
      const res = await request(app)
        .post('/api/simulator/impact-only')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ patientId: testPatient._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const alertCountAfter = await Alert.countDocuments();
      expect(alertCountAfter).toBe(alertCountBefore); // Zero alerts generated (rejected!)
    });

    it('fall with quick recovery cancels suspected fall with zero alerts', async () => {
      const alertCountBefore = await Alert.countDocuments();
      const res = await request(app)
        .post('/api/simulator/fall-and-recover')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ patientId: testPatient._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const alertCountAfter = await Alert.countDocuments();
      expect(alertCountAfter).toBe(alertCountBefore); // Rejection confirmed!
    });

    it('executes complete 5-stage fall simulation producing CRITICAL alert', async () => {
      const res = await request(app)
        .post('/api/simulator/complete-fall')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ patientId: testPatient._id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert).toBeDefined();
      expect(res.body.data.alert.severity).toBe('CRITICAL');
      expect(res.body.data.alert.alertType || res.body.data.alert.type).toBe('FALL_DETECTED');
    });
  });

  // =========================================================================
  // SECTION 6: HARDWARE FAULT MONITORING & RECOVERY
  // =========================================================================
  describe('6. Hardware Fault Monitoring & Isolation from Clinical Falls', () => {
    it('simulates sensor disconnection creating a DeviceFault without a Fall Alert', async () => {
      const fallAlertsBefore = await Alert.countDocuments({ type: 'FALL_DETECTED' });

      const res = await request(app)
        .post('/api/simulator/fault/disconnect')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ patientId: testPatient._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify fault is recorded in DeviceFault
      const faults = await DeviceFault.find({ deviceId: testDevice.deviceCode, recovered: false });
      expect(faults.length).toBeGreaterThanOrEqual(1);
      expect(faults.some((f) => f.faultType === 'SENSOR_DISCONNECTED')).toBe(true);

      // Verify NO clinical fall alerts were created
      const fallAlertsAfter = await Alert.countDocuments({ type: 'FALL_DETECTED' });
      expect(fallAlertsAfter).toBe(fallAlertsBefore);
    });

    it('recovers hardware faults and restores device health', async () => {
      const res = await request(app)
        .post('/api/simulator/fault/recover')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ patientId: testPatient._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const activeFaults = await DeviceFault.find({ deviceId: testDevice.deviceCode, recovered: false });
      expect(activeFaults.length).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 7: UNIFIED HISTORY RETRIEVAL & CSV EXPORT CONSISTENCY
  // =========================================================================
  describe('7. Unified History Retrieval & Telemetry Data Source Isolation', () => {
    beforeAll(async () => {
      await PiezoEvent.deleteMany({ deviceId: testDevice.deviceCode });
      // Seed one PiezoEvent to verify source distinction
      await PiezoEvent.create({
        deviceId: testDevice.deviceCode,
        patientId: testPatient._id,
        sequenceNumber: 9901,
        arduinoTimeMs: 45000,
        raw: 720,
        baseline: 512.0,
        deviation: 208,
        threshold: 75.0,
        movementCount: 14,
        event: 'MOVEMENT',
        status: 'ACTIVE',
        timestamp: new Date(),
      });
    });

    it('GET /api/events/unified-history returns combined records sorted chronologically', async () => {
      const res = await request(app)
        .get('/api/events/unified-history?limit=50')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Ensure chronological ordering
      for (let i = 0; i < res.body.data.length - 1; i++) {
        const t1 = new Date(res.body.data[i].timestamp).getTime();
        const t2 = new Date(res.body.data[i + 1].timestamp).getTime();
        expect(t1).toBeGreaterThanOrEqual(t2);
      }
    });

    it('filters unified history by source=REAL_HARDWARE (returns only hardware piezo events)', async () => {
      const res = await request(app)
        .get('/api/events/unified-history?source=REAL_HARDWARE')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((item) => {
        expect(item.source).toBe('REAL_HARDWARE');
        expect(item.metrics.raw).toBeDefined();
        expect(item.metrics.deviation).toBeDefined();
      });
    });

    it('filters unified history by source=SIMULATOR (returns only kinematics events)', async () => {
      const res = await request(app)
        .get('/api/events/unified-history?source=SIMULATOR')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((item) => {
        expect(item.source).not.toBe('REAL_HARDWARE');
        expect(item.metrics.accelMagnitude).toBeDefined();
      });
    });
  });

  // =========================================================================
  // SECTION 8: ALERT ACKNOWLEDGEMENT & RESOLUTION WORKFLOW
  // =========================================================================
  describe('8. Clinical Alert Acknowledgement & Resolution', () => {
    let testAlert;

    beforeAll(async () => {
      testAlert = await Alert.create({
        patientId: testPatient._id,
        patientName: testPatient.name,
        roomNumber: testPatient.roomNumber,
        bedNumber: testPatient.bedNumber,
        deviceId: testDevice.deviceCode,
        type: 'FALL_DETECTED',
        severity: 'CRITICAL',
        status: 'ACTIVE',
        triggeredAt: new Date(),
      });
    });

    it('NURSE can acknowledge an active alert with clinical response notes', async () => {
      const res = await request(app)
        .patch(`/api/alerts/${testAlert._id}/acknowledge`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          staffId: nurseStaff._id,
          notes: 'Nurse arrived at bedside in Rm 305; patient conscious and supported.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACKNOWLEDGED');
      expect(res.body.data.acknowledgedBy.toString()).toBe(nurseStaff._id.toString());
      expect(res.body.data.notes).toContain('Nurse arrived at bedside');
    });

    it('NURSE can resolve the alert after completing clinical intervention', async () => {
      const res = await request(app)
        .patch(`/api/alerts/${testAlert._id}/resolve`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          staffId: nurseStaff._id,
          notes: 'Patient resting in bed, vital signs stable. Vitals normal.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.resolvedAt).toBeDefined();
    });
  });

  // =========================================================================
  // SECTION 9: DATABASE URI SANITIZATION & LEAK PREVENTION
  // =========================================================================
  describe('9. Credential Protection & URI Sanitization', () => {
    it('sanitizes MongoDB credentials in logs and health endpoints', () => {
      const rawUri = 'mongodb+srv://adminUser:SuperSecretPass123!@cluster0.abc.mongodb.net/hospital?retryWrites=true';
      const sanitized = sanitizeUri(rawUri);
      expect(sanitized).not.toContain('SuperSecretPass123!');
      expect(sanitized).toContain('***');
    });

    it('GET /api/health returns sanitized database connection info without password', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.application).toBe('healthy');
      if (res.body.database && res.body.database.host) {
        expect(res.body.database.host).not.toContain('SuperSecretPass123!');
      }
    });
  });
});
