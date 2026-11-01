const authService = require('../services/auth.service');

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const clientIp = req.ip || req.connection?.remoteAddress;
      const result = await authService.login(email, password, clientIp);

      // Set secure HTTP-only cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({
        success: true,
        message: 'Login successful',
        token: result.token,
        staff: result.staff,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async logout(req, res) {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
    });
    res.json({ success: true, message: 'Logged out successfully' });
  }

  async me(req, res) {
    res.json({
      success: true,
      staff: req.staff,
    });
  }
}

module.exports = new AuthController();
