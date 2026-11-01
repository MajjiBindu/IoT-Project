const staffService = require('../services/staff.service');

class StaffController {
  async getStaff(req, res, next) {
    try {
      const staffList = await staffService.getAllStaff();
      res.json({ success: true, count: staffList.length, data: staffList });
    } catch (err) {
      next(err);
    }
  }

  async getStaffById(req, res, next) {
    try {
      const staff = await staffService.getStaffById(req.params.id);
      res.json({ success: true, data: staff });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async createStaff(req, res, next) {
    try {
      const newStaff = await staffService.createStaff(req.body);
      res.status(201).json({ success: true, message: 'Staff member created successfully', data: newStaff });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async updateStaff(req, res, next) {
    try {
      const updated = await staffService.updateStaff(req.params.id, req.body, req.staff);
      res.json({ success: true, message: 'Staff member updated successfully', data: updated });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { status } = req.body;
      const updated = await staffService.updateStatus(req.params.id, status, req.staff);
      res.json({ success: true, message: `Staff account status changed to ${status}`, data: updated });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
}

module.exports = new StaffController();
