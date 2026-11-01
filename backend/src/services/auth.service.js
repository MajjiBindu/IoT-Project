const jwt = require('jsonwebtoken');
const staffRepository = require('../repositories/staff.repository');
const { clearRateLimit } = require('../middleware/rateLimiter');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital_mobility_jwt_secure_key_2026_dev_random_signature_string';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthService {
  /**
   * Authenticate staff member with email and password
   */
  async login(email, password, clientIp = null) {
    if (!email || typeof email !== 'string' || !email.trim()) {
      const err = new Error('Email is required');
      err.statusCode = 400;
      throw err;
    }

    if (!password || typeof password !== 'string') {
      const err = new Error('Password is required');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const staff = await staffRepository.findByEmail(normalizedEmail, true);

    if (!staff) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const isMatch = await staff.comparePassword(password);
    if (!isMatch) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (staff.status !== 'ACTIVE') {
      const err = new Error('Account has been deactivated. Please contact a clinical administrator.');
      err.statusCode = 403;
      throw err;
    }

    // Clear failed login attempts upon success
    if (clientIp) {
      clearRateLimit(clientIp);
    }

    // Generate signed token
    const token = jwt.sign(
      {
        id: staff._id,
        email: staff.email,
        role: staff.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      token,
      staff: staff.toJSON(),
    };
  }

  /**
   * Verify token and load active staff record
   */
  async verifyToken(token) {
    if (!token) {
      const err = new Error('Authentication required. No token provided.');
      err.statusCode = 401;
      throw err;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        const err = new Error('Session has expired. Please log in again.');
        err.statusCode = 401;
        throw err;
      }
      const err = new Error('Invalid or corrupted authentication token.');
      err.statusCode = 401;
      throw err;
    }

    const staff = await staffRepository.findById(decoded.id);
    if (!staff) {
      const err = new Error('Staff member account no longer exists.');
      err.statusCode = 401;
      throw err;
    }

    if (staff.status !== 'ACTIVE') {
      const err = new Error('Account has been deactivated.');
      err.statusCode = 403;
      throw err;
    }

    return staff;
  }
}

module.exports = new AuthService();
