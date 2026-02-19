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
    const value = req[source];
    const { error, value: validated } = schema.validate(value, { abortEarly: false });
    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, message);
    }
    req.validated = validated;
    next();
  });
