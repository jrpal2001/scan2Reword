import Joi from 'joi';

export const onboardingValidation = {
  /** Create uses multipart: images from req.s3Uploads. Body can be empty. */
  create: Joi.object({}).optional(),

  /** Update uses multipart: imageUrl from req.s3Uploads. Body can be empty. */
  update: Joi.object({}).optional(),

  list: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),

  publicList: Joi.object({
    limit: Joi.number().integer().min(1).max(50).optional(),
  }),
};
