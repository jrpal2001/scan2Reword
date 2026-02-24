import { asyncHandler } from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Validate request using a Joi schema.
 * On success: sets req.validated to the validated value and calls next().
 * On error: throws ApiError(400) with Joi error messages.
 *
 * @param {Joi.ObjectSchema} schema - Joi schema (e.g. authValidation.register)
 * @param {string} source - 'body' | 'params' | 'query' (default 'body')
 */
export const validateRequest = (schema, source = 'body') =>
  asyncHandler((req, res, next) => {
    console.log(`[Validate Request] Validating ${source}:`, {
      path: req.path,
      method: req.method,
      hasValue: !!req[source],
      valueKeys: req[source] ? Object.keys(req[source]) : [],
    });
    const value = req[source];
    const { error, value: validated } = schema.validate(value, { abortEarly: false });
    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      console.log('[Validate Request] Validation failed:', {
        path: req.path,
        errors: error.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
      });
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, message);
    }
    console.log('[Validate Request] Validation passed:', { path: req.path });
    req.validated = validated;
    next();
  });
