const Staff = require('../models/Staff');

class StaffRepository {
  async findAll(query = {}) {
    return await Staff.find(query).sort({ fullName: 1 });
  }

  async findById(id) {
    return await Staff.findById(id);
  }

  async findByEmail(email, includePassword = false) {
    const q = Staff.findOne({ email: email.toLowerCase().trim() });
    if (includePassword) {
      q.select('+password');
    }
    return await q;
  }

  async create(staffData) {
    return await Staff.create(staffData);
  }

  async update(id, updateData) {
    // If password is being updated, we use document save to trigger pre-save hash hook
    if (updateData.password) {
      const staff = await Staff.findById(id).select('+password');
      if (!staff) return null;
      Object.assign(staff, updateData);
      return await staff.save();
    }
    return await Staff.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async count(query = {}) {
    return await Staff.countDocuments(query);
  }
}

module.exports = new StaffRepository();
