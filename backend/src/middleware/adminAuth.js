const jwt = require('jsonwebtoken');

function authenticateAdminToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Admin authentication required.'
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Authentication is not configured.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required.'
      });
    }

    const adminId = Number(decoded.sub);

    if (!Number.isSafeInteger(adminId) || adminId < 1) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin authentication token.'
      });
    }

    req.adminId = adminId;
    req.adminRole = decoded.role || 'admin';

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired admin token.'
    });
  }
}

module.exports = { authenticateAdminToken };
