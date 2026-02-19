import Joi from 'joi';

export const notificationValidation = {
  subscribeToken: Joi.object({
    token: Joi.string().trim().min(1).required(),
  }),

  sendToAll: Joi.object({
    title: Joi.string().trim().min(1).max(200).required(),
    body: Joi.string().trim().min(1).max(500).required(),
    link: Joi.string().uri().allow('').optional(),
    img: Joi.string().uri().allow('').optional(),
  }),

  sendToUsers: Joi.object({
    userIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
    title: Joi.string().trim().min(1).max(200).required(),
    body: Joi.string().trim().min(1).max(500).required(),
    link: Joi.string().uri().allow('').optional(),
    img: Joi.string().uri().allow('').optional(),
  }),

  deleteMyNotification: Joi.object({
    notificationId: Joi.string().hex().length(24).required(),
  }),
};
