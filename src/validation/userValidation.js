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

const addressSchema = Joi.object({
  street: Joi.string().trim().allow('').optional(),
  city: Joi.string().trim().allow('').optional(),
  state: Joi.string().trim().allow('').optional(),
  pincode: Joi.string().trim().allow('').optional(),
}).optional();

const objectIdSchema = Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/).allow('', null);

/** Admin create user — can set role */
export const userValidation = {
  createUser: Joi.object({
    mobile: mobileSchema,
    fullName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().trim().lowercase().allow('').optional(),
    role: Joi.string().valid(ROLES.USER, ROLES.MANAGER, ROLES.STAFF).default(ROLES.USER),
    password: Joi.string().min(6).when('role', {
      is: Joi.string().valid(ROLES.MANAGER, ROLES.STAFF),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }).messages({
      'string.min': 'Password must be at least 6 characters long',
    }),
    address: addressSchema,
    managerCode: Joi.string().trim().max(50).when('role', {
      is: ROLES.MANAGER,
      then: Joi.optional(),
      otherwise: Joi.forbidden(),
    }),
    staffCode: Joi.string().trim().max(50).when('role', {
      is: ROLES.STAFF,
      then: Joi.optional(),
      otherwise: Joi.forbidden(),
    }),
    assignedManagerId: objectIdSchema.when('role', {
      is: ROLES.STAFF,
      then: Joi.optional(),
      otherwise: Joi.forbidden(),
    }),
    vehicle: vehicleSchema.optional(),
  }),

  /** Manager/Staff create user — Manager can create staff or user, Staff can only create user */
  createUserByOperator: Joi.object({
    mobile: mobileSchema,
    fullName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().trim().lowercase().allow('').optional(),
    role: Joi.string().valid(ROLES.USER, ROLES.STAFF).default(ROLES.USER),
    password: Joi.string().min(6).when('role', {
      is: ROLES.STAFF,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }).messages({
      'string.min': 'Password must be at least 6 characters long',
    }),
    address: addressSchema,
    staffCode: Joi.string().trim().max(50).when('role', {
      is: ROLES.STAFF,
      then: Joi.optional(),
      otherwise: Joi.forbidden(),
    }),
    assignedManagerId: objectIdSchema.when('role', {
      is: ROLES.STAFF,
      then: Joi.optional(),
      otherwise: Joi.forbidden(),
    }),
    vehicle: vehicleSchema.optional(),
  }),

  /** Admin update user */
  updateUser: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).optional(),
    email: Joi.string().email().trim().lowercase().allow('').optional(),
    role: Joi.string().valid(ROLES.USER, ROLES.MANAGER, ROLES.STAFF).optional(),
    address: addressSchema,
    managerCode: Joi.string().trim().max(50).allow('', null).optional(),
    staffCode: Joi.string().trim().max(50).allow('', null).optional(),
    assignedManagerId: objectIdSchema.optional(),
  }),

  /** Admin update user status */
  updateUserStatus: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'blocked').required(),
    reason: Joi.string().trim().allow('').optional(),
  }),
};
