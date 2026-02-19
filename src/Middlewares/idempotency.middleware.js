import { idempotencyKeyRepository } from '../repositories/idempotencyKey.repository.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Idempotency Middleware
 * 
 * Optional middleware that checks for Idempotency-Key header.
 * If present, ensures the same request isn't processed twice.
 * 
 * Usage:
 * - Add `Idempotency-Key` header to request (optional)
 * - If key exists and request was already processed, returns cached response
 * - If key doesn't exist, processes request and stores response
 * 
 * Key format: Any string (recommended: UUID or client-generated unique string)
 * Expiry: 24 hours (configurable)
 */
export const idempotencyMiddleware = (options = {}) => {
  const {
    expiryHours = 24, // Default 24 hours expiry
    headerName = 'Idempotency-Key',
  } = options;

  return async (req, res, next) => {
    // Get idempotency key from header
    const idempotencyKey = req.headers[headerName.toLowerCase()] || req.headers[headerName];

    // If no key provided, proceed normally (idempotency is optional)
    if (!idempotencyKey) {
      return next();
    }

    // Validate key format (should be non-empty string)
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      return next(
        new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          `Invalid ${headerName} header. Must be a non-empty string.`
        )
      );
    }

    // Get userId from authenticated user (must be authenticated)
    if (!req.user || !req.user._id) {
      return next(
        new ApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'Authentication required for idempotency'
        )
      );
    }

    const userId = req.user._id.toString();
    const trimmedKey = idempotencyKey.trim();

    try {
      // Check if this key was already used
      const existing = await idempotencyKeyRepository.findByKey(trimmedKey, userId);

      if (existing) {
        // Request was already processed - return cached response
        console.log(`[Idempotency] Returning cached response for key: ${trimmedKey.substring(0, 8)}...`);
        
        // Set status code and return cached response
        res.status(existing.statusCode).json(existing.responseBody);
        return; // Don't call next() - response already sent
      }

      // Key doesn't exist - this is a new request
      // Store original json method to capture response
      const originalJson = res.json.bind(res);
      
      // Override res.json to capture response before sending
      res.json = function (body) {
        // Calculate expiry date
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiryHours);

        // Store idempotency key record (async, don't block response)
        idempotencyKeyRepository.create({
          key: trimmedKey,
          userId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode || HTTP_STATUS.OK,
          responseBody: body,
          expiresAt,
        }).catch((error) => {
          // Log error but don't fail the request
          console.error('[Idempotency] Failed to store idempotency key:', error.message);
        });

        // Call original json method
        return originalJson(body);
      };

      // Proceed to next middleware/controller
      next();
    } catch (error) {
      // If idempotency check fails, log but don't block request
      console.error('[Idempotency] Error checking idempotency key:', error.message);
      // Proceed with request (fail-open approach)
      next();
    }
  };
};
