const mongoose = require('mongoose');

const DeviceFaultSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    faultType: {
      type: String,
      enum: [
        'SENSOR_DISCONNECTED',
        'SERIAL_COMM_FAILURE',
        'INVALID_READINGS',
        'SENSOR_SATURATED',
        'ABNORMAL_CALIBRATION',
        'MISSING_PACKETS',
        'BACKEND_COMM_FAILURE',
        'BATTERY_FAILURE',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'WARNING', 'INFO'],
      default: 'WARNING',
    },
    details: {
      type: String,
      default: '',
    },
    recovered: {
      type: Boolean,
      default: false,
      index: true,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    recoveredAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

DeviceFaultSchema.index({ deviceId: 1, recovered: 1 });
DeviceFaultSchema.index({ faultType: 1, occurredAt: -1 });

module.exports = mongoose.model('DeviceFault', DeviceFaultSchema);

