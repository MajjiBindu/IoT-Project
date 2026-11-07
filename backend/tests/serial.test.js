const EventEmitter = require('events');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const Patient = require('../src/models/Patient');
const Device = require('../src/models/Device');
const Alert = require('../src/models/Alert');
const PiezoEvent = require('../src/models/PiezoEvent');
const Staff = require('../src/models/Staff');
const { SerialBridgeService } = require('../src/services/serialBridge.service');
const defaultSerialBridge = require('../src/services/serialBridge.service');
const fallDetectionService = require('../src/services/fallDetection.service');
const sseManager = require('../src/sockets/sse.manager');

class MockSerialPort extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.isOpen = false;
  }

  open(callback) {
    if (MockSerialPort.simulateOpenError) {
      const err = new Error(MockSerialPort.simulateOpenError);
      if (callback) setImmediate(() => callback(err));
      return;
    }
    this.isOpen = true;
    if (callback) setImmediate(() => callback(null));
  }

  close(callback) {
    this.isOpen = false;
    this.emit('close');
    if (callback) setImmediate(() => callback(null));
  }

  pipe(parser) {
    this.parser = parser;
    return parser;
  }
}
MockSerialPort.simulateOpenError = null;

class MockReadlineParser extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
  }
}

describe('Hospital Mobility Project — Arduino USB Serial Integration Tests', () => {
  let testPatient;
  let testDevice;
  let adminToken;
  let nurseToken;
  let bridge;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SERIAL_ENABLED = 'false';
    await connectDB();

    await Patient.init();
    await Device.init();
    await Alert.init();
    await PiezoEvent.init();
    await Staff.init();

    // Clean up test records
    await Patient.deleteMany({ assignedDeviceId: 'ARDUINO-PIEZO-01' });
    await Device.deleteMany({ deviceCode: { $in: ['ARDUINO-PIEZO-01', 'ARDUINO-UNASSIGNED'] } });
    await PiezoEvent.deleteMany({});

    // Create staff accounts and tokens
    const secret = process.env.JWT_SECRET || 'hospital_mobility_jwt_secure_key_2026_dev_random_signature_string';
    await Staff.deleteMany({ email: { $in: ['admin@serialtest.org', 'nurse@serialtest.org'] } });

    const adminStaff = await Staff.create({
      fullName: 'Serial Test Admin',
      email: 'admin@serialtest.org',
      password: 'AdminPassword123!',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    const nurseStaff = await Staff.create({
      fullName: 'Serial Test Nurse',
      email: 'nurse@serialtest.org',
      password: 'NursePassword123!',
      role: 'NURSE',
      status: 'ACTIVE',
    });

    adminToken = jwt.sign({ id: adminStaff._id, role: 'ADMIN', email: adminStaff.email }, secret);
    nurseToken = jwt.sign({ id: nurseStaff._id, role: 'NURSE', email: nurseStaff.email }, secret);

    testPatient = await Patient.create({
      name: 'Serial Test Patient',
      roomNumber: '301',
      bedNumber: 'Bed-A',
      status: 'ADMITTED',
      assignedDeviceId: 'ARDUINO-PIEZO-01',
      movementStatus: 'STATIONARY',
      piezoActivityStatus: 'UNKNOWN',
      synthetic: true,
    });

    testDevice = await Device.create({
      deviceCode: 'ARDUINO-PIEZO-01',
      status: 'ACTIVE',
      batteryLevel: 100,
      assignedPatientId: testPatient._id,
    });
  });

  beforeEach(async () => {
    await PiezoEvent.deleteMany({});
    MockSerialPort.simulateOpenError = null;

    bridge = new SerialBridgeService({
      SerialPort: MockSerialPort,
      ReadlineParser: MockReadlineParser,
      portName: 'COM5',
      baudRate: 9600,
      deviceCode: 'ARDUINO-PIEZO-01',
      reconnectIntervalMs: 100,
    });
  });

  afterAll(async () => {
    if (bridge) await bridge.stop();
    if (defaultSerialBridge) await defaultSerialBridge.stop();
    sseManager.clear();
    await disconnectDB();
  });

  // =========================================================================
  // 1. Packet Parsing and Numeric Validation
  // =========================================================================
  describe('1. Packet Parsing and Numeric Validation', () => {
    it('successfully parses and persists a valid DATA telemetry line', async () => {
      const line = 'DATA,0,4500,720,580.25,140,75.00,1,MOVEMENT,ACTIVE';
      const result = await bridge.handleIncomingLine(line);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.event).toBeDefined();

      const saved = await PiezoEvent.findById(result.event._id);
      expect(saved).not.toBeNull();
      expect(saved.sequenceNumber).toBe(0);
      expect(saved.arduinoTimeMs).toBe(4500);
      expect(saved.raw).toBe(720);
      expect(saved.baseline).toBe(580.25);
      expect(saved.deviation).toBe(140);
      expect(saved.threshold).toBe(75);
      expect(saved.movementCount).toBe(1);
      expect(saved.event).toBe('MOVEMENT');
      expect(saved.status).toBe('ACTIVE');
      expect(saved.deviceId).toBe('ARDUINO-PIEZO-01');
      expect(saved.patientId.toString()).toBe(testPatient._id.toString());
    });

    it('ignores startup, calibration, and CSV header messages without throwing or creating records', async () => {
      const nonDataMessages = [
        'HOSPITAL_MOBILITY_SYSTEM',
        'CALIBRATION_STARTED',
        'CALIBRATION_COMPLETED',
        'SENSOR_READY',
        'DATA,SEQUENCE,TIME_MS,RAW,BASELINE,DEVIATION,THRESHOLD,MOVEMENT_COUNT,EVENT,STATUS',
        'RANDOM_SERIAL_NOISE_123',
        '',
      ];

      for (const msg of nonDataMessages) {
        const result = await bridge.handleIncomingLine(msg);
        expect(result).toBeNull();
      }

      const count = await PiezoEvent.countDocuments();
      expect(count).toBe(0);
    });

    it('rejects incomplete and malformed packets with missing or non-numeric tokens', async () => {
      const malformed = [
        'DATA,0,4500,720,580.25', // Incomplete (< 10 fields)
        'DATA,abc,4500,720,580.25,140,75.00,1,MOVEMENT,ACTIVE', // Invalid sequenceNumber
        'DATA,0,time,720,580.25,140,75.00,1,MOVEMENT,ACTIVE', // Invalid time
        'DATA,0,4500,NaN,580.25,140,75.00,1,MOVEMENT,ACTIVE', // NaN sensor raw
        'DATA,0,4500,720,580.25,140,75.00,1,INVALID_EVENT,ACTIVE', // Invalid event enum
        'DATA,0,4500,720,580.25,140,75.00,1,MOVEMENT,INVALID_STATUS', // Invalid status enum
      ];

      const initialDropped = bridge.stats.droppedPackets;

      for (const line of malformed) {
        const result = await bridge.handleIncomingLine(line);
        expect(result).toBeNull();
      }

      expect(bridge.stats.droppedPackets).toBe(initialDropped + malformed.length);
      const count = await PiezoEvent.countDocuments();
      expect(count).toBe(0);
    });
  });

  // =========================================================================
  // 2. Duplicate Sequence Rejection and Idempotency
  // =========================================================================
  describe('2. Duplicate Sequence Rejection and Idempotency', () => {
    it('discards duplicate sequence packets for the same device', async () => {
      const packet = 'DATA,99,5000,600,500.0,100,50.0,2,MOVEMENT,ACTIVE';

      // First ingestion succeeds
      const firstRes = await bridge.handleIncomingLine(packet);
      expect(firstRes.success).toBe(true);

      // Duplicate ingestion fails idempotency check
      const dupRes = await bridge.handleIncomingLine(packet);
      expect(dupRes.duplicate).toBe(true);
      expect(bridge.stats.duplicatePackets).toBe(1);

      // Verify only 1 record exists in database
      const count = await PiezoEvent.countDocuments({ deviceId: 'ARDUINO-PIEZO-01', sequenceNumber: 99 });
      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // 3. Patient Activity Semantics and SENSOR_CHECK Diagnostics
  // =========================================================================
  describe('3. Patient Activity Semantics and SENSOR_CHECK Diagnostics', () => {
    it('updates patient to MOVEMENT_DETECTED upon receiving MOVEMENT event', async () => {
      const packet = 'DATA,1,6000,750,550.0,200,80.0,1,MOVEMENT,ACTIVE';
      await bridge.handleIncomingLine(packet);

      const patient = await Patient.findById(testPatient._id);
      expect(patient.piezoActivityStatus).toBe('MOVEMENT_DETECTED');
      expect(bridge.lastPiezoActivity).toBe('MOVEMENT_DETECTED');
    });

    it('updates patient to NO_RECENT_MOVEMENT upon receiving INACTIVITY event', async () => {
      const packet = 'DATA,2,7000,510,505.0,5,80.0,1,INACTIVITY,ACTIVE';
      await bridge.handleIncomingLine(packet);

      const patient = await Patient.findById(testPatient._id);
      expect(patient.piezoActivityStatus).toBe('NO_RECENT_MOVEMENT');
      expect(bridge.lastPiezoActivity).toBe('NO_RECENT_MOVEMENT');
    });

    it('retains previous piezo activity status upon receiving NONE event', async () => {
      // First set to MOVEMENT_DETECTED
      await bridge.handleIncomingLine('DATA,3,8000,720,550.0,170,80.0,2,MOVEMENT,ACTIVE');
      let patient = await Patient.findById(testPatient._id);
      expect(patient.piezoActivityStatus).toBe('MOVEMENT_DETECTED');

      // Now receive NONE
      await bridge.handleIncomingLine('DATA,4,9000,550,550.0,0,80.0,2,NONE,ACTIVE');
      patient = await Patient.findById(testPatient._id);
      expect(patient.piezoActivityStatus).toBe('MOVEMENT_DETECTED');
      expect(bridge.lastPiezoActivity).toBe('MOVEMENT_DETECTED');
    });

    it('preserves SENSOR_CHECK as diagnostic info and does NOT change patient activity', async () => {
      // Establish baseline state
      await Patient.findByIdAndUpdate(testPatient._id, { piezoActivityStatus: 'NO_RECENT_MOVEMENT' });

      // Receive SENSOR_CHECK with MOVEMENT event
      const packet = 'DATA,5,10000,999,500.0,499,80.0,3,MOVEMENT,SENSOR_CHECK';
      await bridge.handleIncomingLine(packet);

      // Verify patient status was NOT changed to MOVEMENT_DETECTED
      const patient = await Patient.findById(testPatient._id);
      expect(patient.piezoActivityStatus).toBe('NO_RECENT_MOVEMENT');
      expect(bridge.lastSensorStatus).toBe('SENSOR_CHECK');
    });

    it('updates lastMovementDetectedAt and lastMovementCount on MOVEMENT, and preserves it on INACTIVITY', async () => {
      // 1. Initial MOVEMENT packet
      const packet1 = 'DATA,10,12000,780,550.0,230,80.0,7,MOVEMENT,ACTIVE';
      await bridge.handleIncomingLine(packet1);

      expect(bridge.lastMovementCount).toBe(7);
      expect(bridge.lastMovementDetectedAt).not.toBeNull();
      const firstMovementTime = bridge.lastMovementDetectedAt;

      // 2. INACTIVITY packet arrives later
      await new Promise((r) => setTimeout(r, 20));
      const packet2 = 'DATA,11,13000,520,510.0,10,80.0,7,INACTIVITY,ACTIVE';
      await bridge.handleIncomingLine(packet2);

      // Verify lastReceivedAt and sequence updated, but lastMovementDetectedAt remains UNCHANGED
      expect(bridge.lastSequenceNumber).toBe(11);
      expect(bridge.lastMovementCount).toBe(7);
      expect(bridge.lastMovementDetectedAt.getTime()).toBe(firstMovementTime.getTime());
      expect(bridge.lastPiezoActivity).toBe('NO_RECENT_MOVEMENT');

      // 3. NONE packet arrives later
      const packet3 = 'DATA,12,14000,510,510.0,0,80.0,7,NONE,ACTIVE';
      await bridge.handleIncomingLine(packet3);
      expect(bridge.lastSequenceNumber).toBe(12);
      expect(bridge.lastMovementDetectedAt.getTime()).toBe(firstMovementTime.getTime());
    });
  });

  // =========================================================================
  // 4. Device and Patient Association
  // =========================================================================
  describe('4. Device and Patient Association', () => {
    it('stores telemetry with patientId null when device is unassigned', async () => {
      // Create unassigned device
      await Device.create({
        deviceCode: 'ARDUINO-UNASSIGNED',
        status: 'ACTIVE',
        assignedPatientId: null,
      });

      const unassignedBridge = new SerialBridgeService({
        deviceCode: 'ARDUINO-UNASSIGNED',
        portName: 'COM5',
      });

      const packet = 'DATA,1,1000,500,500.0,0,50.0,0,NONE,ACTIVE';
      const res = await unassignedBridge.handleIncomingLine(packet);

      expect(res.success).toBe(true);
      expect(res.event.patientId).toBeNull();
      expect(res.event.deviceId).toBe('ARDUINO-UNASSIGNED');
    });

    it('updates device heartbeat when valid telemetry packet is processed', async () => {
      const devBefore = await Device.findOne({ deviceCode: 'ARDUINO-PIEZO-01' });
      const oldHeartbeat = devBefore.lastHeartbeat;

      await new Promise((r) => setTimeout(r, 10));
      await bridge.handleIncomingLine('DATA,20,11000,600,550.0,50,60.0,1,NONE,ACTIVE');

      const devAfter = await Device.findOne({ deviceCode: 'ARDUINO-PIEZO-01' });
      expect(new Date(devAfter.lastHeartbeat).getTime()).toBeGreaterThanOrEqual(new Date(oldHeartbeat).getTime());
    });
  });

  // =========================================================================
  // 5. Architectural Restrictions: No Fall Detection Invocation, No Alerts
  // =========================================================================
  describe('5. Architectural Restrictions: No Fall Detection Invocation, Zero Fall Alerts', () => {
    it('never calls fallDetectionService.evaluatePacket and generates zero fall alerts', async () => {
      const evaluateSpy = jest.spyOn(fallDetectionService, 'evaluatePacket');
      const alertsCountBefore = await Alert.countDocuments();

      // High deviation vibration burst
      const packet = 'DATA,30,12000,1023,500.0,523,75.0,5,MOVEMENT,ACTIVE';
      await bridge.handleIncomingLine(packet);

      expect(evaluateSpy).not.toHaveBeenCalled();

      const alertsCountAfter = await Alert.countDocuments();
      expect(alertsCountAfter).toBe(alertsCountBefore);

      evaluateSpy.mockRestore();
    });
  });

  // =========================================================================
  // 6. Serial REST Endpoints and Authorization
  // =========================================================================
  describe('6. Serial REST Endpoints and Authorization', () => {
    it('GET /api/serial/status returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/serial/status');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/serial/status returns 200 with structured status when authenticated', async () => {
      const res = await request(app)
        .get('/api/serial/status')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.port).toBeDefined();
      expect(res.body.data.status).toBeDefined();
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.lastMovementCount).toBeDefined();
    });

    it('POST /api/serial/reconnect returns 403 Forbidden for NURSE role', async () => {
      const res = await request(app)
        .post('/api/serial/reconnect')
        .set('Authorization', `Bearer ${nurseToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/serial/reconnect returns 200 for ADMIN role', async () => {
      const res = await request(app)
        .post('/api/serial/reconnect')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  // =========================================================================
  // 7. Connection Lifecycle, Error Recovery, and Graceful Shutdown
  // =========================================================================
  describe('7. Connection Lifecycle, Error Recovery, and Graceful Shutdown', () => {
    it('transitions to CONNECTED on successful open', async () => {
      process.env.SERIAL_ENABLED = 'true';
      await bridge.start();
      expect(bridge.status).toBe('CONNECTED');
      expect(bridge.lastError).toBeNull();
      process.env.SERIAL_ENABLED = 'false';
    });

    it('handles port open error gracefully without crashing', async () => {
      MockSerialPort.simulateOpenError = 'Port COM5 does not exist';
      const failingBridge = new SerialBridgeService({
        SerialPort: MockSerialPort,
        ReadlineParser: MockReadlineParser,
        portName: 'COM5',
        reconnectIntervalMs: 10000,
      });

      process.env.SERIAL_ENABLED = 'true';
      await failingBridge.start();
      expect(failingBridge.status).toBe('ERROR');
      expect(failingBridge.lastError).toContain('Port COM5 does not exist');
      await failingBridge.stop();
      process.env.SERIAL_ENABLED = 'false';
    });

    it('stops cleanly and releases resources upon stop()', async () => {
      process.env.SERIAL_ENABLED = 'true';
      await bridge.start();
      expect(bridge.status).toBe('CONNECTED');

      await bridge.stop();
      expect(bridge.status).toBe('DISCONNECTED');
      expect(bridge.isStopped).toBe(true);
      expect(bridge.port).toBeNull();
      process.env.SERIAL_ENABLED = 'false';
    });
  });
});
