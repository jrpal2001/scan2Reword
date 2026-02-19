import Joi from 'joi';

const pointsConfigSchema = Joi.object({
  registration: Joi.number().min(0).optional(),
  referral: Joi.number().min(0).optional(),
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
}).optional();

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
