import Joi from 'joi';
import { ROLES } from '../constants/roles.js';

const mobileSchema = Joi.string().trim().pattern(/^[6-9]\d{9}$/).required().messages({
  'string.pattern.base': 'Mobile must be a valid 10-digit Indian number',
});

const vehicleSchema = Joi.object({
  vehicleNumber: Joi.string().trim().required(),
  vehicleType: Joi.string().valid('Two-Wheeler', 'Three-Wheeler', 'Four-Wheeler', 'Commercial').required(),
  fuelType: Joi.string().valid('Petrol', 'Diesel', 'CNG', 'Electric').required(),
  brand: Joi.string().trim().allow('').optional(),
  model: Joi.string().trim().allow('').optional(),
  yearOfManufacture: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
});

/** Admin create user — can set role */
export const userValidation = {
  createUser: Joi.object({
    mobile: mobileSchema,
    fullName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().trim().lowercase().allow('').optional(),
    role: Joi.string().valid(ROLES.USER, ROLES.MANAGER, ROLES.STAFF).default(ROLES.USER),
    vehicle: vehicleSchema.optional(),
  }),

  /** Manager/Staff create user — customer only, optional vehicle */
  createUserByOperator: Joi.object({
    mobile: mobileSchema,
    fullName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().trim().lowercase().allow('').optional(),
    vehicle: vehicleSchema.optional(),
  }),

  /** Admin update user */
  updateUser: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).optional(),
    email: Joi.string().email().trim().lowercase().allow('').optional(),
    role: Joi.string().valid(ROLES.USER, ROLES.MANAGER, ROLES.STAFF).optional(),
  }),

  /** Admin update user status */
  updateUserStatus: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'blocked').required(),
    reason: Joi.string().trim().allow('').optional(),
  }),
};
