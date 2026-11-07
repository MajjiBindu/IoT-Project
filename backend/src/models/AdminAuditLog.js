const mongoose = require('mongoose');

const AdminAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
      enum: [
        'REGISTER_PATIENT',
        'UPDATE_PATIENT',
        'DISCHARGE_PATIENT',
        'ASSIGN_NURSE',
        'ASSIGN_DEVICE',
        'UNASSIGN_DEVICE',
        'RELOCATE_PATIENT',
        'CREATE_STAFF',
        'UPDATE_STAFF_STATUS',
        'RECONNECT_SERIAL',
        'SYSTEM_CONFIG_CHANGE',
      ],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true,
    },
    performerName: {
      type: String,
      required: true,
    },
    performerRole: {
      type: String,
      default: 'ADMIN',
    },
    targetType: {
      type: String,
      enum: ['PATIENT', 'DEVICE', 'STAFF', 'LOCATION', 'SYSTEM'],
      required: true,
    },
    targetId: {
      type: String,
      default: null,
    },
    targetName: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AdminAuditLogSchema.index({ targetType: 1, targetId: 1 });
AdminAuditLogSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('AdminAuditLog', AdminAuditLogSchema);

