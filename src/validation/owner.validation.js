import Joi from 'joi';

const mobileSchema = Joi.string().trim().pattern(/^[6-9]\d{9}$/).required().messages({
  'string.pattern.base': 'Mobile must be a valid 10-digit Indian number',
});

const vehicleSchema = Joi.object({
  vehicleNumber: Joi.string().trim().required(),
  vehicleType: Joi.string().valid('Two-Wheeler', 'Three-Wheeler', 'Four-Wheeler', 'Commercial').optional().allow('', null),
  fuelType: Joi.string().valid('Petrol', 'Diesel', 'CNG', 'Electric').optional().allow('', null),
  brand: Joi.string().trim().allow('').optional(),
  model: Joi.string().trim().allow('').optional(),
  yearOfManufacture: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
  rcPhoto: Joi.string().trim().allow('', null).optional(),
  insurancePhoto: Joi.string().trim().allow('', null).optional(),
  fitnessPhoto: Joi.string().trim().allow('', null).optional(),
  pollutionPhoto: Joi.string().trim().allow('', null).optional(),
  vehiclePhoto: Joi.array().items(Joi.string().trim()).optional(),
});

export const ownerValidation = {
  searchOwner: Joi.object({
    identifier: Joi.string().trim().min(1).required(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),

  addVehicle: Joi.object({
    user: Joi.object({
      mobile: mobileSchema,
      fullName: Joi.string().trim().min(2).max(100).required(),
      email: Joi.string().email().trim().lowercase().allow('').optional(),
      address: Joi.object({
        street: Joi.string().trim().allow('').optional(),
        city: Joi.string().trim().allow('').optional(),
        state: Joi.string().trim().allow('').optional(),
        pincode: Joi.string().trim().allow('').optional(),
      }).optional(),
    }).required(),
    vehicle: vehicleSchema.required(),
  }),
};
