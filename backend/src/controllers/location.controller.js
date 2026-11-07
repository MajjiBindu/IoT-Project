const locationService = require('../services/location.service');

class LocationController {
  async getLocations(req, res, next) {
    try {
      const locations = await locationService.getLocations(req.query);
      res.json({ success: true, count: locations.length, data: locations });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async getPatientHistory(req, res, next) {
    try {
      const history = await locationService.getPatientHistory(
        req.params.patientId,
        req.query.limit
      );
      res.json({ success: true, count: history.length, data: history });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async getPatientCurrent(req, res, next) {
    try {
      const current = await locationService.getPatientCurrentLocation(req.params.patientId);
      res.json({ success: true, data: current });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async recordLocation(req, res, next) {
    try {
      const result = await locationService.recordLocation(req.body, req.staff);
      res.status(201).json({
        success: true,
        message: 'Location event recorded successfully',
        data: result.locationEvent,
        patient: result.patient,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          duplicate: !!err.duplicate,
          message: err.message,
        });
      }
      next(err);
    }
  }

  async getWardLocations(req, res, next) {
    try {
      const result = await locationService.getWardLocations(req.params.wardId);
      res.json({ success: true, data: result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
}

module.exports = new LocationController();
