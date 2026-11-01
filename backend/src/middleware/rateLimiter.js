/**
 * In-memory sliding window rate limiter for login protection
 */
const loginAttempts = new Map(); // ip -> { count, firstAttemptTime }
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

function loginRateLimiter(req, res, next) {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();

  const record = loginAttempts.get(clientIp);

  if (record) {
    // Check if window has expired
    if (now - record.firstAttemptTime > WINDOW_MS) {
      loginAttempts.set(clientIp, { count: 1, firstAttemptTime: now });
      return next();
    }

    if (record.count >= MAX_ATTEMPTS) {
      const waitMinutes = Math.ceil((WINDOW_MS - (now - record.firstAttemptTime)) / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts from this address. Please wait ${waitMinutes} minute(s) before trying again.`,
      });
    }

    record.count += 1;
  } else {
    loginAttempts.set(clientIp, { count: 1, firstAttemptTime: now });
  }

  next();
}

function clearRateLimit(ip) {
  if (ip) loginAttempts.delete(ip);
}

module.exports = { loginRateLimiter, clearRateLimit };
