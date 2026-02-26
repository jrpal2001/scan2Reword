import Joi from 'joi';

const vehicleTypeSchema = Joi.string().valid('Two-Wheeler', 'Three-Wheeler', 'Four-Wheeler', 'Commercial');
const fuelTypeSchema = Joi.string().valid('Petrol', 'Diesel', 'CNG', 'Electric');

export const vehicleValidation = {
  create: Joi.object({
    vehicleNumber: Joi.string().trim().required(),
    vehicleType: vehicleTypeSchema.optional().allow('', null),
    fuelType: fuelTypeSchema.optional().allow('', null),
    brand: Joi.string().trim().allow('').optional(),
    model: Joi.string().trim().allow('').optional(),
    yearOfManufacture: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
    rcPhoto: Joi.string().trim().allow('', null).optional(),
    insurancePhoto: Joi.string().trim().allow('', null).optional(),
    fitnessPhoto: Joi.string().trim().allow('', null).optional(),
    pollutionPhoto: Joi.string().trim().allow('', null).optional(),
    vehiclePhoto: Joi.array().items(Joi.string().trim()).optional(),
  }),

  update: Joi.object({
    vehicleNumber: Joi.string().trim().optional(),
    vehicleType: vehicleTypeSchema.optional(),
    fuelType: fuelTypeSchema.optional(),
    brand: Joi.string().trim().allow('').optional(),
    model: Joi.string().trim().allow('').optional(),
    yearOfManufacture: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
    rcPhoto: Joi.string().trim().allow('', null).optional(),
    insurancePhoto: Joi.string().trim().allow('', null).optional(),
    fitnessPhoto: Joi.string().trim().allow('', null).optional(),
    pollutionPhoto: Joi.string().trim().allow('', null).optional(),
    vehiclePhoto: Joi.array().items(Joi.string().trim()).optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
  }).min(1),
};
