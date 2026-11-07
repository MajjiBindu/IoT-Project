const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
    },
    bedNumber: {
      type: String,
      required: [true, 'Bed number is required'],
      trim: true,
    },
    floor: {
      type: String,
      default: 'Floor 3',
      trim: true,
    },
    wardId: {
      type: String,
      default: 'WARD-3B',
      trim: true,
    },
    locationStatus: {
      type: String,
      enum: ['ASSIGNED', 'LOCATION_UPDATED', 'UNKNOWN', 'NOT_AVAILABLE'],
      default: 'ASSIGNED',
    },
    locationSource: {
      type: String,
      enum: ['MANUAL', 'BLE_BEACON', 'WIFI_TRIANGULATION', 'GPS', 'UWB', 'SENSOR_DERIVED'],
      default: 'MANUAL',
    },
    age: {
      type: Number,
      min: 0,
      max: 130,
      default: 68,
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'],
      default: 'NOT_SPECIFIED',
    },
    fallRiskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM',
    },
    assignedNurseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    status: {
      type: String,
      enum: ['ADMITTED', 'DISCHARGED'],
      default: 'ADMITTED',
    },
    assignedDeviceId: {
      type: String,
      default: null,
    },
    movementStatus: {
      type: String,
      enum: ['WALKING', 'STATIONARY', 'UNKNOWN'],
      default: 'STATIONARY',
    },
    lastMovementUpdate: {
      type: Date,
      default: Date.now,
    },
    piezoActivityStatus: {
      type: String,
      enum: ['MOVEMENT_DETECTED', 'NO_RECENT_MOVEMENT', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    lastPiezoActivityUpdate: {
      type: Date,
      default: null,
    },
    lastLocationUpdate: {
      type: Date,
      default: Date.now,
    },
    synthetic: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup by device, room/bed sorting, and ward queries
PatientSchema.index({ assignedDeviceId: 1 }, { sparse: true });
PatientSchema.index({ assignedNurseId: 1 }, { sparse: true });
PatientSchema.index({ roomNumber: 1, bedNumber: 1 });
PatientSchema.index({ wardId: 1 });
PatientSchema.index({ fallRiskLevel: 1 });

module.exports = mongoose.model('Patient', PatientSchema);
