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
  rcPhoto: Joi.string().trim().allow('', null).optional(),
  insurancePhoto: Joi.string().trim().allow('', null).optional(),
  fitnessPhoto: Joi.string().trim().allow('', null).optional(),
  pollutionPhoto: Joi.string().trim().allow('', null).optional(),
  vehiclePhoto: Joi.array().items(Joi.string().trim()).optional(),
});

const addressObjectSchema = Joi.object({
  street: Joi.string().trim().allow('').optional(),
  city: Joi.string().trim().allow('').optional(),
  state: Joi.string().trim().allow('').optional(),
  pincode: Joi.string().trim().allow('').optional(),
});

/** Accepts object or JSON string (form-data sends address as string) */
const addressSchema = Joi.alternatives()
  .try(
    addressObjectSchema,
    Joi.string().trim().custom((value, helpers) => {
      if (!value) return undefined;
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== 'object' || parsed === null) return helpers.error('any.invalid');
        const { error } = addressObjectSchema.validate(parsed);
        if (error) return helpers.error('any.invalid');
        return parsed;
      } catch (e) {
        return helpers.error('any.invalid');
      }
    })
  )
  .optional();

const objectIdSchema = Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/).allow('', null);

/**
 * Parse JSON string; if it fails (e.g. unquoted keys like address:), try quoting keys and parse again.
 * Form-data often has unquoted keys (e.g. address:{"street":"..."}).
 */
function parseJsonRelaxed(str) {
  if (typeof str !== 'string' || !str.trim()) return undefined;
  try {
    return JSON.parse(str);
  } catch (e) {
    // Try repairing unquoted keys: ,key: or {key: -> ,"key": or {"key":
    const repaired = str.replace(/([,{])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    try {
      return JSON.parse(repaired);
    } catch (e2) {
      throw e;
    }
  }
}

/** Vehicle: object or JSON string (form-data sends as string) */
const vehicleSchemaOrString = Joi.alternatives().try(
  vehicleSchema,
  Joi.string().trim().custom((value, helpers) => {
    if (!value) return undefined;
    try {
      const parsed = typeof value === 'string' ? parseJsonRelaxed(value) : value;
      const { error, value: out } = vehicleSchema.validate(parsed);
      if (error) return helpers.error('any.invalid');
      return out;
    } catch (e) {
      return helpers.error('any.invalid');
    }
  })
);

/** Owner object for non-registered: object or JSON string */
const ownerObjectSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required(),
  mobile: mobileSchema,
  email: Joi.string().email().trim().lowercase().allow('').optional(),
  address: addressSchema.optional(),
});
const ownerSchemaOrString = Joi.alternatives().try(
  ownerObjectSchema,
  Joi.string().trim().custom((value, helpers) => {
    if (!value) return undefined;
    try {
      const parsed = typeof value === 'string' ? parseJsonRelaxed(value) : value;
      const { error, value: out } = ownerObjectSchema.validate(parsed);
      if (error) return helpers.error('any.invalid');
      return out;
    } catch (e) {
      return helpers.error('any.invalid');
    }
  })
);

/** Admin create user — can set role */
export const userValidation = {
  createUser: Joi.object({
    /** When true, create only fleet owner (no driver, no vehicle). Requires role=user, accountType=organization, ownerType=non-registered. */
    ownerOnly: Joi.boolean().optional(),
    // Account type: individual or organization (fleet) - only for role=USER (form-data: normalize case)
    accountType: Joi.when('role', {
      is: ROLES.USER,
      then: Joi.string().trim().lowercase().valid('individual', 'organization').default('individual'),
      otherwise: Joi.optional().allow(null, ''), // Ignore for manager/staff
    }),
    mobile: Joi.when('ownerOnly', { is: true, then: Joi.optional(), otherwise: mobileSchema }),
    fullName: Joi.when('ownerOnly', { is: true, then: Joi.optional(), otherwise: Joi.string().trim().min(2).max(100).required() }),
    email: Joi.string().email().trim().lowercase().allow('').optional(),
    role: Joi.string().trim().lowercase().valid(ROLES.USER, ROLES.MANAGER, ROLES.STAFF).default(ROLES.USER),
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
    pumpId: objectIdSchema.when('role', {
      is: ROLES.STAFF,
      then: Joi.optional(),
      otherwise: Joi.forbidden(),
    }),
    vehicle: Joi.when('ownerOnly', { is: true, then: Joi.forbidden(), otherwise: vehicleSchemaOrString.optional() }),
    // Organization (Fleet) fields - only for role=USER and accountType=organization (form-data: normalize case)
    ownerType: Joi.when('role', {
      is: ROLES.USER,
      then: Joi.when('accountType', {
        is: 'organization',
        then: Joi.string().trim().lowercase().valid('registered', 'non-registered').required(),
        otherwise: Joi.optional().forbidden(),
      }),
      otherwise: Joi.optional().forbidden(),
    }),
    ownerIdentifier: Joi.when('ownerType', {
      is: 'registered',
      then: Joi.string().trim().required(),
      otherwise: Joi.optional(),
    }),
    owner: Joi.when('ownerType', {
      is: 'non-registered',
      then: ownerSchemaOrString.required(),
      otherwise: Joi.optional(),
    }),
    referralCode: Joi.string().trim().allow('', null).optional(),
  }),

  /** Manager/Staff create user — Manager can create staff or user, Staff can only create user */
  createUserByOperator: Joi.object({
    ownerOnly: Joi.boolean().optional(),
    accountType: Joi.when('role', {
      is: ROLES.USER,
      then: Joi.string().valid('individual', 'organization').default('individual'),
      otherwise: Joi.optional().allow(null, ''), // Ignore for staff
    }),
    mobile: Joi.when('ownerOnly', { is: true, then: Joi.optional(), otherwise: mobileSchema }),
    fullName: Joi.when('ownerOnly', { is: true, then: Joi.optional(), otherwise: Joi.string().trim().min(2).max(100).required() }),
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
    pumpId: objectIdSchema.when('role', {
      is: ROLES.STAFF,
      then: Joi.optional(),
      otherwise: Joi.forbidden(),
    }),
    vehicle: Joi.when('ownerOnly', { is: true, then: Joi.forbidden(), otherwise: vehicleSchema.optional() }),
    // Organization (Fleet) fields - only for role=USER and accountType=organization
    ownerType: Joi.when('role', {
      is: ROLES.USER,
      then: Joi.when('accountType', {
        is: 'organization',
        then: Joi.string().valid('registered', 'non-registered').required(),
        otherwise: Joi.optional().forbidden(),
      }),
      otherwise: Joi.optional().forbidden(),
    }),
    ownerIdentifier: Joi.when('ownerType', {
      is: 'registered',
      then: Joi.string().trim().required(),
      otherwise: Joi.optional(),
    }),
    owner: Joi.when('ownerType', {
      is: 'non-registered',
      then: Joi.object({
        fullName: Joi.string().trim().min(2).max(100).required(),
        mobile: mobileSchema,
        email: Joi.string().email().trim().lowercase().allow('').optional(),
        address: addressSchema.optional(),
      }).required(),
      otherwise: Joi.optional(),
    }),
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

  /** Admin delete user - optional query type to target manager, staff, or user */
  deleteUser: Joi.object({
    type: Joi.string().valid('manager', 'staff', 'user').optional(),
  }),
};
