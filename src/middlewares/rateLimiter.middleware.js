import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * In-memory rate limiter
 * Simple implementation using Map to store request counts
 * For production, consider using Redis or MongoDB-based rate limiting
 */
const requestCounts = new Map();
const requestWindows = new Map();

/**
 * Clean up old entries periodically (every 5 minutes)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of requestWindows.entries()) {
    if (now > window.expiresAt) {
      requestCounts.delete(key);
      requestWindows.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * Rate limiter middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.maxRequests - Maximum requests per window (default: 100)
 * @param {string} options.keyGenerator - Function to generate key from request (default: IP)
 * @returns {Function} Express middleware
 */
export const rateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    maxRequests = 100, // 100 requests per window default
    keyGenerator = (req) => {
      // Default: use IP address
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    console.log(`[Rate Limiter] Checking rate limit for:`, { key, path: req.path, method: req.method });

    // Get or create request window
    let window = requestWindows.get(key);
    if (!window || now > window.expiresAt) {
      // Create new window
      window = {
        count: 0,
        expiresAt: now + windowMs,
      };
      requestWindows.set(key, window);
      requestCounts.set(key, 0);
      console.log(`[Rate Limiter] New window created for key:`, key);
    }

    // Increment count
    const count = (requestCounts.get(key) || 0) + 1;
    requestCounts.set(key, count);

    console.log(`[Rate Limiter] Request count:`, { key, count, maxRequests, limitExceeded: count > maxRequests });

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', new Date(window.expiresAt).toISOString());

    // Check if limit exceeded
    if (count > maxRequests) {
      console.log(`[Rate Limiter] Rate limit exceeded for key:`, key);
      return next(
        new ApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          `Too many requests. Limit: ${maxRequests} requests per ${windowMs / 1000 / 60} minutes. Try again after ${new Date(window.expiresAt).toISOString()}`
        )
      );
    }

    next();
  };
};

/**
 * Strict rate limiter for auth endpoints (OTP, login)
 * More restrictive limits
 */
export const strictRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // Only 5 requests per 15 minutes
});

/**
 * Per-user rate limiter (for authenticated requests)
 */
export const userRateLimiter = (options = {}) => {
  return rateLimiter({
    ...options,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise fall back to IP
      if (req.user && req.user._id) {
        return `user:${req.user._id}`;
      }
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
  });
};
