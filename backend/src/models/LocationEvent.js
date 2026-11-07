const mongoose = require('mongoose');

const LocationEventSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
    },
    bedNumber: {
      type: String,
      default: '',
      trim: true,
    },
    wardId: {
      type: String,
      default: 'WARD-3B',
      trim: true,
    },
    floor: {
      type: String,
      default: 'Floor 3',
      trim: true,
    },
    status: {
      type: String,
      enum: ['ASSIGNED', 'LOCATION_UPDATED', 'UNKNOWN', 'NOT_AVAILABLE'],
      default: 'LOCATION_UPDATED',
    },
    source: {
      type: String,
      enum: ['MANUAL', 'BLE_BEACON', 'WIFI_TRIANGULATION', 'GPS', 'UWB', 'SENSOR_DERIVED'],
      default: 'MANUAL',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast chronological lookups and spatial queries
LocationEventSchema.index({ patientId: 1, timestamp: -1 });
LocationEventSchema.index({ roomNumber: 1 });
LocationEventSchema.index({ wardId: 1 });

module.exports = mongoose.model('LocationEvent', LocationEventSchema);
