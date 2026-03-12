import Joi from 'joi';

/** Same date/time filters as transaction list, but no pagination (no page, limit). */
export const statsValidation = {
  review: Joi.object({
    pumpId: Joi.string().hex().length(24).optional(),
    userId: Joi.string().hex().length(24).optional(),
    fuelType: Joi.string().valid('Petrol', 'Diesel', 'CNG').optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    month: Joi.number().integer().min(1).max(12).optional(),
    year: Joi.number().integer().min(2000).max(2100).optional(),
    startTime: Joi.string().trim().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional(),
    endTime: Joi.string().trim().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional(),
  }),

  /** User registration graph: date range only (no time-of-day). Optional groupBy. */
  userRegistrationGraph: Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    month: Joi.number().integer().min(1).max(12).optional(),
    year: Joi.number().integer().min(2000).max(2100).optional(),
    groupBy: Joi.string().valid('day', 'month').optional(),
  }),
};
