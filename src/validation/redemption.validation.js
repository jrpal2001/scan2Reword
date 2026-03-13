import Joi from 'joi';

export const redemptionValidation = {
  create: Joi.object({
    rewardId: Joi.string().hex().length(24).required(),
  }),

  /** At-pump: pumpId optional for Staff (derived from their single assignment); required for Manager/Admin */
  atPumpRedemption: Joi.object({
    identifier: Joi.string().trim().min(1).required(),
    pointsToDeduct: Joi.number().integer().min(1).required(),
    pumpId: Joi.string().hex().length(24).optional(),
  }),

  approve: Joi.object({
    reason: Joi.string().trim().allow('').optional(),
  }),

  reject: Joi.object({
    reason: Joi.string().trim().allow('').optional(),
  }),

  /** Admin direct redeem: pumpId required so we can track at which pump redemption was done */
  directRedemption: Joi.object({
    userId: Joi.string().hex().length(24).required(),
    pointsToDeduct: Joi.number().integer().min(1).required(),
    pumpId: Joi.string().hex().length(24).required(),
  }),
};
