const authService = require('../services/auth.service');

/**
 * Middleware to authenticate requests using JWT
 * Supports Authorization header, HTTP-only cookie, or ?token query param (for SSE)
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. HTTP-only cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 3. Query parameter for EventSource SSE (which cannot send headers)
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const staff = await authService.verifyToken(token);
    req.staff = staff;
    next();
  } catch (err) {
    return res.status(err.statusCode || 401).json({
      success: false,
      message: err.message || 'Authentication failed',
    });
  }
}

/**
 * Middleware to restrict endpoints to specific staff roles
 * @param  {...string} roles Allowed roles ('ADMIN', 'NURSE')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.staff.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires ${roles.join(' or ')} privileges.`,
      });
    }

    next();
  };
}

module.exports = { authenticate, authorize };
