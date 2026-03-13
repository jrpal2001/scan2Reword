import Joi from 'joi';

export const pumpBackgroundValidation = {
    create: Joi.object({
        pumpId: Joi.string()
            .trim()
            .required()
            .custom((value, helpers) => {
                if (!/^[0-9a-fA-F]{24}$/.test(value)) {
                    return helpers.error('any.invalid');
                }
                return value;
            })
            .messages({
                'any.invalid': 'Invalid pumpId format'
            }),
    }),
    update: Joi.object({
        // Add any fields that can be updated in body
    }),
};
