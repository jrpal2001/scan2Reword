import Joi from 'joi';

export const scanValidation = {
  validateIdentifier: Joi.object({
    identifier: Joi.string().trim().min(1).required(),
  }),
};
