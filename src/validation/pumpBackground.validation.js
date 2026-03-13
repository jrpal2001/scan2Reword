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
        existingImages: Joi.alternatives().try(
            Joi.string().trim(),
            Joi.array().items(Joi.string().trim())
        ).optional(),
    }),
};
