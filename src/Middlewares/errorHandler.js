import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';

/**
 * Global error handler middleware.
 * Map known errors to HTTP status and consistent JSON shape.
 */
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join('; ');
    return res.status(400).json({
      success: false,
      message: message || 'Validation failed',
      data: null,
      meta: null,
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}`,
      data: null,
      meta: null,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
      data: null,
      meta: null,
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = config.nodeEnv === 'production' ? 'Internal Server Error' : (err.message || 'Internal Server Error');

  if (config.nodeEnv !== 'production') {
    console.error('Error:', err.message, err.stack);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    meta: config.nodeEnv !== 'production' ? { stack: err.stack } : null,
  });
};
