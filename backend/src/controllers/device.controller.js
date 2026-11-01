const deviceService = require('../services/device.service');

class DeviceController {
  async getDevices(req, res, next) {
    try {
      const { status } = req.query;
      const query = status ? { status } : {};
      const devices = await deviceService.getAllDevices(query);
      res.json({ success: true, data: devices });
    } catch (err) {
      next(err);
    }
  }

  async getOverview(req, res, next) {
    try {
      const overview = await deviceService.getOverview();
      res.json({ success: true, data: overview });
    } catch (err) {
      next(err);
    }
  }

  async getDeviceById(req, res, next) {
    try {
      const device = await deviceService.getDeviceById(req.params.id);
      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found' });
      }
      res.json({ success: true, data: device });
    } catch (err) {
      next(err);
    }
  }

  async registerDevice(req, res, next) {
    try {
      const device = await deviceService.registerDevice(req.body);
      res.status(201).json({ success: true, data: device });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async updateDevice(req, res, next) {
    try {
      const updated = await deviceService.updateDevice(req.params.id, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async assignDevice(req, res, next) {
    try {
      const { patientId } = req.body;
      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId is required in body' });
      }
      const result = await deviceService.assignDevice(req.params.id, patientId);
      res.json({ success: true, data: result.device, patient: result.patient });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async unassignDevice(req, res, next) {
    try {
      const result = await deviceService.unassignDevice(req.params.id);
      res.json({ success: true, data: result.device });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
}

module.exports = new DeviceController();
