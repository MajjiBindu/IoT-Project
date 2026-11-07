const serialBridgeService = require('../services/serialBridge.service');

class SerialController {
  /**
   * GET /api/serial/status
   * Returns live status of the USB serial bridge
   */
  async getStatus(req, res, next) {
    try {
      const status = await serialBridgeService.getStatus();
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/serial/reconnect
   * Triggers manual reconnection (ADMIN only)
   */
  async reconnect(req, res, next) {
    try {
      const updatedStatus = await serialBridgeService.reconnect();
      res.json({
        success: true,
        message: 'Serial bridge reconnection initiated',
        data: updatedStatus,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SerialController();
