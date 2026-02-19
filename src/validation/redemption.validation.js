import Joi from 'joi';

export const redemptionValidation = {
  create: Joi.object({
    rewardId: Joi.string().hex().length(24).required(),
  }),

  atPumpRedemption: Joi.object({
    identifier: Joi.string().trim().min(1).required(),
    pointsToDeduct: Joi.number().integer().min(1).required(),
    pumpId: Joi.string().hex().length(24).required(),
  }),

  approve: Joi.object({
    reason: Joi.string().trim().allow('').optional(),
  }),

  reject: Joi.object({
    reason: Joi.string().trim().min(1).required(),
  }),
};
