import Joi from 'joi';
import { CAMPAIGN_STATUS } from '../constants/status.js';

const conditionsSchema = Joi.object({
  minAmount: Joi.number().min(0).optional(),
  categories: Joi.array().items(Joi.string().valid('Fuel', 'Lubricant', 'Store', 'Service')).optional(),
  userSegment: Joi.string().trim().allow('').optional(),
  frequencyLimit: Joi.number().integer().min(1).optional(),
});

export const campaignValidation = {
  create: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    type: Joi.string().valid('multiplier', 'bonusPoints', 'bonusPercentage').required(),
    multiplier: Joi.number().min(0).optional(),
    bonusPoints: Joi.number().min(0).optional(),
    bonusPercentage: Joi.number().min(0).max(100).optional(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    conditions: conditionsSchema.optional(),
    pumpIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
    status: Joi.string().valid(...Object.values(CAMPAIGN_STATUS)).default(CAMPAIGN_STATUS.DRAFT),
  }).custom((value, helpers) => {
    // Validate type-specific fields
    if (value.type === 'multiplier' && (!value.multiplier || value.multiplier <= 0)) {
      return helpers.error('any.custom', { message: 'Multiplier is required for multiplier type' });
    }
    if (value.type === 'bonusPoints' && (!value.bonusPoints || value.bonusPoints <= 0)) {
      return helpers.error('any.custom', { message: 'Bonus points is required for bonusPoints type' });
    }
    if (value.type === 'bonusPercentage' && (!value.bonusPercentage || value.bonusPercentage <= 0)) {
      return helpers.error('any.custom', { message: 'Bonus percentage is required for bonusPercentage type' });
    }
    return value;
  }),

  update: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    type: Joi.string().valid('multiplier', 'bonusPoints', 'bonusPercentage').optional(),
    multiplier: Joi.number().min(0).optional(),
    bonusPoints: Joi.number().min(0).optional(),
    bonusPercentage: Joi.number().min(0).max(100).optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    conditions: conditionsSchema.optional(),
    pumpIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
    status: Joi.string().valid(...Object.values(CAMPAIGN_STATUS)).optional(),
  }).min(1),
};
