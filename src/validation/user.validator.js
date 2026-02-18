import Joi from "joi";

const update = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required(),
  password: Joi.string().required(),
  confirmPassword: Joi.string().required(),
});

export default {
  update,
};
