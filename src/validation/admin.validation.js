import Joi from 'joi';

/** Legacy Admin login (email + password) */
export const adminValidation = {
  login: Joi.object({
    email: Joi.string().email().trim().lowercase().required(),
    password: Joi.string().min(1).required(),
  }),
};
