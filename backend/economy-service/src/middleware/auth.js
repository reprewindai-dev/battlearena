const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_ALGORITHM = 'HS256';

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('JWT verification failed:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please refresh your token'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is malformed or invalid'
      });
    }
    
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to verify token'
    });
  }
};

// Optional auth for endpoints that can work without authentication
const optionalAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.user = decoded;
  } catch (error) {
    // Log but don't fail - this is optional auth
    logger.warn('Optional JWT verification failed:', error.message);
    req.user = null;
  }
  
  next();
};

// Admin role verification
const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Admin privileges required'
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware
};
