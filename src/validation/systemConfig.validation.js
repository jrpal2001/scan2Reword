import Joi from 'joi';

const pointsConfigSchema = Joi.object({
  referral: Joi.number().min(0).optional(),
  referralForReferredUser: Joi.number().min(0).optional(),
  displayRupeesPerPoint: Joi.number().min(0).optional(),
  fuel: Joi.object({
    pointsPerLiter: Joi.number().min(0).optional(),
  }).optional(),
  lubricant: Joi.object({
    pointsPer100Rupees: Joi.number().min(0).optional(),
  }).optional(),
  store: Joi.object({
    pointsPer100Rupees: Joi.number().min(0).optional(),
  }).optional(),
  service: Joi.object({
    pointsPer100Rupees: Joi.number().min(0).optional(),
  }).optional(),
  // Allow deprecated keys for cleanup in service layer
  other: Joi.any().optional(),
}).unknown(true).optional(); // Allow unknown keys to pass validation; deprecated keys are cleaned in service

const pointsExpirySchema = Joi.object({
  durationMonths: Joi.number().min(1).optional(),
  notificationDays: Joi.array().items(Joi.number().min(0)).optional(),
}).optional();

export const systemConfigValidation = {
  update: Joi.object({
    points: pointsConfigSchema,
    pointsExpiry: pointsExpirySchema,
  }).min(1), // At least one field must be provided
};
