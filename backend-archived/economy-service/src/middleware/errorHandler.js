const logger = require('../config/logger');
const {
  httpRequestsTotal,
  walletOperationsTotal
} = require('../config/metrics');

class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error({
    error: err,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      user: req.user
    }
  }, 'Error occurred');

  // Increment error metrics
  if (req.route) {
    httpRequestsTotal
      .labels(req.method, req.route.path, '500')
      .inc();
  }

  // PostgreSQL errors
  if (err.code === '23505') {
    const message = 'Duplicate entry violation';
    error = new AppError(message, 409, 'DUPLICATE_ENTRY');
  }

  if (err.code === '23503') {
    const message = 'Foreign key constraint violation';
    error = new AppError(message, 400, 'FOREIGN_KEY_VIOLATION');
  }

  if (err.code === '23502') {
    const message = 'Not null constraint violation';
    error = new AppError(message, 400, 'NOT_NULL_VIOLATION');
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Cast errors
  if (err.name === 'CastError') {
    const message = 'Invalid data format';
    error = new AppError(message, 400, 'INVALID_FORMAT');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  // Rate limiting errors
  if (err.status === 429) {
    const message = 'Too many requests, please try again later';
    error = new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  // Payment provider errors
  if (err.type === 'StripeCardError') {
    const message = `Payment failed: ${err.message}`;
    error = new AppError(message, 400, 'PAYMENT_FAILED');
  }

  if (err.type === 'StripeRateLimitError') {
    const message = 'Payment service temporarily unavailable, please try again';
    error = new AppError(message, 429, 'PAYMENT_RATE_LIMIT');
  }

  if (err.type === 'StripeInvalidRequestError') {
    const message = 'Invalid payment request';
    error = new AppError(message, 400, 'INVALID_PAYMENT_REQUEST');
  }

  // Default error
  if (!error.isOperational) {
    const message = 'Something went wrong';
    error = new AppError(message, 500, 'INTERNAL_ERROR');
  }

  // Increment wallet operation error metrics if applicable
  if (req.originalUrl?.includes('/wallet')) {
    walletOperationsTotal
      .labels('error', 'failed')
      .inc();
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err
      })
    }
  });
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler
};
