import Joi from 'joi';

export const bannerValidation = {
  publicList: Joi.object({
    pumpId: Joi.string().hex().length(24).allow('').optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
  }),

  create: Joi.object({
    title: Joi.string().trim().min(2).max(200).required(),
    description: Joi.string().trim().allow('').optional(),
    imageUrl: Joi.string().uri().allow('').optional(),
    linkUrl: Joi.string().uri().allow('').optional(),
    startTime: Joi.date().required(),
    endTime: Joi.date().required(),
    pumpIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
    status: Joi.string().valid('active', 'expired').default('active'),
  }),

  // Empty object allowed when only updating image (file upload); controller merges req.s3Uploads.imageUrl
  update: Joi.object({
    title: Joi.string().trim().min(2).max(200).optional(),
    description: Joi.string().trim().allow('').optional(),
    imageUrl: Joi.string().uri().allow('').optional(),
    linkUrl: Joi.string().uri().allow('').optional(),
    startTime: Joi.date().optional(),
    endTime: Joi.date().optional(),
    pumpIds: Joi.array().items(Joi.string().hex().length(24)).optional(),
    status: Joi.string().valid('active', 'expired').optional(),
  }),
};
