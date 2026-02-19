import Joi from 'joi';

const vehicleTypeSchema = Joi.string().valid('Two-Wheeler', 'Three-Wheeler', 'Four-Wheeler', 'Commercial');
const fuelTypeSchema = Joi.string().valid('Petrol', 'Diesel', 'CNG', 'Electric');

export const vehicleValidation = {
  create: Joi.object({
    vehicleNumber: Joi.string().trim().required(),
    vehicleType: vehicleTypeSchema.required(),
    fuelType: fuelTypeSchema.required(),
    brand: Joi.string().trim().allow('').optional(),
    model: Joi.string().trim().allow('').optional(),
    yearOfManufacture: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
  }),

  update: Joi.object({
    vehicleNumber: Joi.string().trim().optional(),
    vehicleType: vehicleTypeSchema.optional(),
    fuelType: fuelTypeSchema.optional(),
    brand: Joi.string().trim().allow('').optional(),
    model: Joi.string().trim().allow('').optional(),
    yearOfManufacture: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
    status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
  }).min(1),
};
