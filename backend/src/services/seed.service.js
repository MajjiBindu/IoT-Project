const Patient = require('../models/Patient');
const Device = require('../models/Device');
const LocationEvent = require('../models/LocationEvent');
const Staff = require('../models/Staff');

const SYNTHETIC_PATIENTS = [
  {
    name: 'Eleanor Vance (Synthetic)',
    roomNumber: '101',
    bedNumber: 'Bed-A',
    wardId: 'WARD-3B',
    status: 'ADMITTED',
    movementStatus: 'STATIONARY',
    assignedDeviceId: 'SIM-TAG-01',
    notes: 'Post-op knee recovery. High fall risk protocol.',
  },
  {
    name: 'Marcus Holloway (Synthetic)',
    roomNumber: '101',
    bedNumber: 'Bed-B',
    wardId: 'WARD-3B',
    status: 'ADMITTED',
    movementStatus: 'WALKING',
    assignedDeviceId: 'SIM-TAG-02',
    notes: 'Assisted ambulation encouraged.',
  },
  {
    name: 'Sarah Connor (Synthetic)',
    roomNumber: '102',
    bedNumber: 'Bed-A',
    wardId: 'WARD-3B',
    status: 'ADMITTED',
    movementStatus: 'STATIONARY',
    assignedDeviceId: 'SIM-TAG-03',
    notes: 'Mild cognitive disorientation during night.',
  },
  {
    name: 'Arthur Dent (Synthetic)',
    roomNumber: '102',
    bedNumber: 'Bed-B',
    wardId: 'WARD-3B',
    status: 'ADMITTED',
    movementStatus: 'WALKING',
    assignedDeviceId: 'SIM-TAG-04',
    notes: 'Recovering nicely, frequent hallway walking.',
  },
  {
    name: 'Elena Fisher (Synthetic)',
    roomNumber: '103',
    bedNumber: 'Bed-A',
    wardId: 'WARD-3B',
    status: 'ADMITTED',
    movementStatus: 'STATIONARY',
    assignedDeviceId: 'SIM-TAG-05',
    notes: 'Monitored bed rest.',
  },
  {
    name: 'Garrus Vakarian (Synthetic)',
    roomNumber: '103',
    bedNumber: 'Bed-B',
    wardId: 'WARD-3B',
    status: 'ADMITTED',
    movementStatus: 'STATIONARY',
    assignedDeviceId: 'SIM-TAG-06',
    notes: 'Calibration underway.',
  },
];

const SYNTHETIC_DEVICES = [
  { deviceCode: 'SIM-TAG-01', batteryLevel: 96, status: 'ACTIVE' },
  { deviceCode: 'SIM-TAG-02', batteryLevel: 89, status: 'ACTIVE' },
  { deviceCode: 'SIM-TAG-03', batteryLevel: 92, status: 'ACTIVE' },
  { deviceCode: 'SIM-TAG-04', batteryLevel: 78, status: 'ACTIVE' },
  { deviceCode: 'SIM-TAG-05', batteryLevel: 84, status: 'ACTIVE' },
  { deviceCode: 'SIM-TAG-06', batteryLevel: 99, status: 'ACTIVE' },
  { deviceCode: 'SIM-TAG-SPARE', batteryLevel: 100, status: 'OFFLINE' },
  { deviceCode: 'ARDUINO-PIEZO-01', batteryLevel: 100, status: 'ACTIVE' },
];

async function seedSyntheticData() {
  try {
    // 1. Seed Staff Accounts (Environment-Controlled Credentials)
    const staffCount = await Staff.countDocuments();
    if (staffCount === 0) {
      console.log('[Seed] No staff accounts detected. Seeding initial environment-configured accounts...');

      const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@hospital.org';
      const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'AdminSecure2026!';
      const adminName = process.env.ADMIN_DEFAULT_NAME || 'Chief Clinical Administrator';

      await Staff.create({
        fullName: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      const nurseEmail = process.env.NURSE_DEFAULT_EMAIL || 'nurse@hospital.org';
      const nursePassword = process.env.NURSE_DEFAULT_PASSWORD || 'NurseSecure2026!';
      const nurseName = process.env.NURSE_DEFAULT_NAME || 'Staff Nurse Sarah';

      await Staff.create({
        fullName: nurseName,
        email: nurseEmail,
        password: nursePassword,
        role: 'NURSE',
        status: 'ACTIVE',
      });

      console.log(`[Seed] Seeded default administrator (${adminEmail}) and nurse (${nurseEmail}) accounts.`);
    }

    // 2. Seed Patients and Devices
    const patientCount = await Patient.countDocuments();
    if (patientCount === 0) {
      console.log('[Seed] Database empty. Seeding initial synthetic patient and device data...');

      // Seed Devices
      const createdDevices = [];
      for (const d of SYNTHETIC_DEVICES) {
        const device = await Device.create(d);
        createdDevices.push(device);
      }

      // Seed Patients and link device
      for (const p of SYNTHETIC_PATIENTS) {
        const patient = await Patient.create(p);
        const matchedDevice = createdDevices.find((d) => d.deviceCode === p.assignedDeviceId);
        if (matchedDevice) {
          await Device.findByIdAndUpdate(matchedDevice._id, { assignedPatientId: patient._id });
        }

        // Seed initial LocationEvent for patient
        await LocationEvent.create({
          patientId: patient._id,
          roomNumber: p.roomNumber,
          bedNumber: p.bedNumber,
          wardId: p.wardId || 'WARD-3B',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        });
      }

      console.log(
        `[Seed] Seeded ${SYNTHETIC_PATIENTS.length} synthetic patients, ${SYNTHETIC_DEVICES.length} devices, and baseline location events.`
      );
    } else {
      console.log(`[Seed] Existing dataset found (${patientCount} patients). Checking location events...`);

      // If existing database has patients but no location events, backfill baseline locations
      const locationCount = await LocationEvent.countDocuments();
      if (locationCount === 0) {
        const existingPatients = await Patient.find();
        for (const p of existingPatients) {
          await LocationEvent.create({
            patientId: p._id,
            roomNumber: p.roomNumber,
            bedNumber: p.bedNumber,
            wardId: p.wardId || 'WARD-3B',
            timestamp: p.lastLocationUpdate || p.updatedAt || new Date(),
          });
        }
        console.log(`[Seed] Backfilled ${existingPatients.length} baseline location events.`);
      }

      // Ensure ARDUINO-PIEZO-01 device exists
      const arduinoDevice = await Device.findOne({ deviceCode: 'ARDUINO-PIEZO-01' });
      if (!arduinoDevice) {
        await Device.create({
          deviceCode: 'ARDUINO-PIEZO-01',
          batteryLevel: 100,
          status: 'ACTIVE',
          assignedPatientId: null,
        });
        console.log('[Seed] Registered default ARDUINO-PIEZO-01 device.');
      }
    }
  } catch (err) {
    console.error(`[Seed] Error during seeding: ${err.message}`);
  }
}

module.exports = { seedSyntheticData };
