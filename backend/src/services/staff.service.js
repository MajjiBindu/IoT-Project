const staffRepository = require('../repositories/staff.repository');

const VALID_ROLES = ['ADMIN', 'NURSE'];
const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

class StaffService {
  async getAllStaff() {
    return await staffRepository.findAll();
  }

  async getStaffById(id) {
    const staff = await staffRepository.findById(id);
    if (!staff) {
      const err = new Error('Staff member not found');
      err.statusCode = 404;
      throw err;
    }
    return staff;
  }

  async createStaff(data) {
    let { fullName, email, password, role, status } = data;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      const err = new Error('Full name is required');
      err.statusCode = 400;
      throw err;
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      const err = new Error('Email is required');
      err.statusCode = 400;
      throw err;
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      const err = new Error('Please provide a valid email address');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await staffRepository.findByEmail(normalizedEmail);
    if (existing) {
      const err = new Error(`Staff account with email "${normalizedEmail}" already exists`);
      err.statusCode = 409;
      throw err;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      const err = new Error('Password must be at least 8 characters long');
      err.statusCode = 400;
      throw err;
    }

    role = role ? role.toUpperCase() : 'NURSE';
    if (!VALID_ROLES.includes(role)) {
      const err = new Error(`Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    status = status ? status.toUpperCase() : 'ACTIVE';
    if (!VALID_STATUSES.includes(status)) {
      const err = new Error(`Invalid status. Allowed statuses: ${VALID_STATUSES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const staff = await staffRepository.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      password,
      role,
      status,
    });

    return staff.toJSON();
  }

  async updateStaff(id, data, currentStaff) {
    const staff = await staffRepository.findById(id);
    if (!staff) {
      const err = new Error('Staff member not found');
      err.statusCode = 404;
      throw err;
    }

    const updatePayload = {};

    if (data.fullName !== undefined) {
      if (!data.fullName || !data.fullName.trim()) {
        const err = new Error('Full name cannot be empty');
        err.statusCode = 400;
        throw err;
      }
      updatePayload.fullName = data.fullName.trim();
    }

    if (data.email !== undefined) {
      const normalized = data.email.toLowerCase().trim();
      if (normalized !== staff.email) {
        const existing = await staffRepository.findByEmail(normalized);
        if (existing) {
          const err = new Error(`Email "${normalized}" is already taken by another account`);
          err.statusCode = 409;
          throw err;
        }
        updatePayload.email = normalized;
      }
    }

    if (data.role !== undefined) {
      const roleUpper = data.role.toUpperCase();
      if (!VALID_ROLES.includes(roleUpper)) {
        const err = new Error(`Invalid role. Allowed: ${VALID_ROLES.join(', ')}`);
        err.statusCode = 400;
        throw err;
      }
      updatePayload.role = roleUpper;
    }

    if (data.status !== undefined) {
      const statusUpper = data.status.toUpperCase();
      if (!VALID_STATUSES.includes(statusUpper)) {
        const err = new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`);
        err.statusCode = 400;
        throw err;
      }
      if (statusUpper === 'INACTIVE' && currentStaff && staff._id.toString() === currentStaff._id.toString()) {
        const err = new Error('You cannot deactivate your own administrative account');
        err.statusCode = 400;
        throw err;
      }
      updatePayload.status = statusUpper;
    }

    if (data.password) {
      if (typeof data.password !== 'string' || data.password.length < 8) {
        const err = new Error('Password must be at least 8 characters long');
        err.statusCode = 400;
        throw err;
      }
      updatePayload.password = data.password;
    }

    const updated = await staffRepository.update(id, updatePayload);
    return updated.toJSON ? updated.toJSON() : updated;
  }

  async updateStatus(id, status, currentStaff) {
    if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
      const err = new Error(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const normalizedStatus = status.toUpperCase();

    const staff = await staffRepository.findById(id);
    if (!staff) {
      const err = new Error('Staff member not found');
      err.statusCode = 404;
      throw err;
    }

    if (normalizedStatus === 'INACTIVE' && currentStaff && staff._id.toString() === currentStaff._id.toString()) {
      const err = new Error('You cannot deactivate your own administrative account');
      err.statusCode = 400;
      throw err;
    }

    const updated = await staffRepository.update(id, { status: normalizedStatus });
    return updated.toJSON ? updated.toJSON() : updated;
  }
}

module.exports = new StaffService();
