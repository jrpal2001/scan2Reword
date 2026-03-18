import Joi from 'joi';

export const walletValidation = {
  adjust: Joi.object({
    userId: Joi.string().hex().length(24).required(),
    points: Joi.number().positive().required(),
    type: Joi.string().valid('credit', 'debit', 'adjustment', 'refund', 'expiry').required(),
    reason: Joi.string().trim().allow('').optional(),
  }),

  /** Admin: redeem/refund referral points for manager/staff */
  redeemEmployeePoints: Joi.object({
    ownerId: Joi.string().hex().length(24).required(),
    ownerType: Joi.string().valid('Manager', 'Staff').required(),
    points: Joi.number().positive().required(),
    reason: Joi.string().trim().allow('').optional(),
  }),
};
