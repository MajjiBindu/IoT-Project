const mongoose = require('mongoose');
const deviceFaultRepository = require('../repositories/deviceFault.repository');
const deviceRepository = require('../repositories/device.repository');
const sseManager = require('../sockets/sse.manager');

class HardwareFaultService {
  async recordFault({ deviceId, faultType, severity = 'WARNING', details = '' }) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return null;
      }
      const active = await deviceFaultRepository.findLatestActiveFault(deviceId, faultType);
      if (active) {
        // Already active; do not duplicate
        return active;
      }

      const fault = await deviceFaultRepository.create({
        deviceId,
        faultType,
        severity,
        details,
        occurredAt: new Date(),
        recovered: false,
      });

      // Update Device status
      try {
        const device = await deviceRepository.findByCode(deviceId);
        if (device) {
          const newFaultStatus = severity === 'CRITICAL' ? 'FAULTED' : 'DEGRADED';
          await deviceRepository.update(device._id, {
            faultStatus: newFaultStatus,
            lastFaultType: faultType,
            lastFaultAt: new Date(),
          });
        }
      } catch (dErr) {
        console.warn(`[HardwareFaultService] Device update note: ${dErr.message}`);
      }

      console.warn(`[HardwareFaultService] FAULT RECORDED [${severity}] ${deviceId}: ${faultType} - ${details}`);

      // Broadcast over SSE
      sseManager.broadcast('hardware_fault', {
        id: fault._id,
        deviceId,
        faultType,
        severity,
        details,
        occurredAt: fault.occurredAt,
        timestamp: new Date(),
      });

      return fault;
    } catch (err) {
      console.error(`[HardwareFaultService] Error recording fault: ${err.message}`);
      return null;
    }
  }

  async recordRecovery(deviceId, faultType, resolutionNotes = 'Auto-recovered') {
    try {
      if (mongoose.connection.readyState !== 1) {
        return null;
      }
      const result = await deviceFaultRepository.markRecoveredByType(deviceId, faultType, resolutionNotes);

      // Check remaining active faults
      const remaining = await deviceFaultRepository.findActiveByDevice(deviceId);
      try {
        const device = await deviceRepository.findByCode(deviceId);
        if (device) {
          const nextFaultStatus = remaining.length === 0 ? 'HEALTHY' : remaining.some((f) => f.severity === 'CRITICAL') ? 'FAULTED' : 'DEGRADED';
          await deviceRepository.update(device._id, {
            faultStatus: nextFaultStatus,
          });
        }
      } catch (dErr) {
        console.warn(`[HardwareFaultService] Device recovery update note: ${dErr.message}`);
      }

      console.log(`[HardwareFaultService] FAULT RECOVERED ${deviceId}: ${faultType}`);

      sseManager.broadcast('hardware_fault_recovered', {
        deviceId,
        faultType,
        resolutionNotes,
        timestamp: new Date(),
      });

      return result;
    } catch (err) {
      console.error(`[HardwareFaultService] Error recording recovery: ${err.message}`);
      return null;
    }
  }

  async getActiveFaults(deviceId = null) {
    if (deviceId) {
      return await deviceFaultRepository.findActiveByDevice(deviceId);
    }
    return await deviceFaultRepository.findAll({ recovered: false });
  }

  async getFaultHistory(query = {}, limit = 100) {
    return await deviceFaultRepository.findAll(query, limit);
  }
}

module.exports = new HardwareFaultService();

