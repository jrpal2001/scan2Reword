import Joi from 'joi';

const pointsConfigSchema = Joi.object({
  registration: Joi.number().min(0).optional(),
  referral: Joi.number().min(0).optional(),
  // Accept fuel as number (pointsPerLiter) or object format
  fuel: Joi.alternatives().try(
    Joi.number().min(0), // Simple format: fuel: 0.25
    Joi.object({
      pointsPerLiter: Joi.number().min(0).optional(),
    })
  ).optional(),
  // Accept lubricant as number (pointsPer100Rupees) or object format
  lubricant: Joi.alternatives().try(
    Joi.number().min(0), // Simple format: lubricant: 5
    Joi.object({
      pointsPer100Rupees: Joi.number().min(0).optional(),
    })
  ).optional(),
  // Accept store as number (pointsPer100Rupees) or object format
  store: Joi.alternatives().try(
    Joi.number().min(0), // Simple format: store: 5
    Joi.object({
      pointsPer100Rupees: Joi.number().min(0).optional(),
    })
  ).optional(),
  // Accept service as number (pointsPer100Rupees) or object format
  service: Joi.alternatives().try(
    Joi.number().min(0), // Simple format: service: 5
    Joi.object({
      pointsPer100Rupees: Joi.number().min(0).optional(),
    })
  ).optional(),
  // Allow other fields (will be removed during normalization)
  other: Joi.any().optional(),
}).unknown(true).optional(); // Allow unknown keys to pass validation, will be cleaned in service

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
