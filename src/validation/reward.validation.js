import Joi from 'joi';

export const rewardValidation = {
  create: Joi.object({
    name: Joi.string().trim().min(2).max(200).required(),
    type: Joi.string().valid('discount', 'freeItem', 'cashback', 'voucher').required(),
    pointsRequired: Joi.number().integer().min(1).required(),
    value: Joi.number().min(0).required(),
    discountType: Joi.string().valid('percentage', 'fixed', 'free').default('fixed'),
    availability: Joi.string().valid('unlimited', 'limited').default('unlimited'),
    totalQuantity: Joi.number().integer().min(1).optional(),
    validFrom: Joi.date().required(),
    validUntil: Joi.date().required(),
    applicablePumps: Joi.array().items(Joi.string().hex().length(24)).optional(),
    status: Joi.string().valid('active', 'inactive', 'expired').default('active'),
    description: Joi.string().trim().allow('').optional(),
    imageUrl: Joi.string().uri().allow('').optional(),
  }).custom((value, helpers) => {
    if (value.availability === 'limited' && (!value.totalQuantity || value.totalQuantity <= 0)) {
      return helpers.error('any.custom', { message: 'Total quantity is required for limited availability' });
    }
    return value;
  }),

  update: Joi.object({
    name: Joi.string().trim().min(2).max(200).optional(),
    type: Joi.string().valid('discount', 'freeItem', 'cashback', 'voucher').optional(),
    pointsRequired: Joi.number().integer().min(1).optional(),
    value: Joi.number().min(0).optional(),
    discountType: Joi.string().valid('percentage', 'fixed', 'free').optional(),
    availability: Joi.string().valid('unlimited', 'limited').optional(),
    totalQuantity: Joi.number().integer().min(1).optional(),
    validFrom: Joi.date().optional(),
    validUntil: Joi.date().optional(),
    applicablePumps: Joi.array().items(Joi.string().hex().length(24)).optional(),
    status: Joi.string().valid('active', 'inactive', 'expired').optional(),
    description: Joi.string().trim().allow('').optional(),
    imageUrl: Joi.string().uri().allow('').optional(),
  }).min(1),
};
