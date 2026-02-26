import Joi from 'joi';
import { PUMP_STATUS } from '../constants/status.js';

const locationSchema = Joi.object({
  address: Joi.string().trim().allow('').optional(),
  city: Joi.string().trim().allow('').optional(),
  state: Joi.string().trim().allow('').optional(),
  pincode: Joi.string().trim().pattern(/^\d{6}$/).allow('').optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
});

export const pumpValidation = {
  create: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    code: Joi.string().trim().min(2).max(20).uppercase().optional(), // Auto-generated if omitted (PREFIX + padded number)
    managerId: Joi.string()
      .trim()
      .allow('', null)
      .custom((value, helpers) => {
        // If empty string, convert to null
        if (value === '') {
          return null;
        }
        // If provided, validate it's a valid MongoDB ObjectId (24 hex chars)
        if (value && !/^[0-9a-fA-F]{24}$/.test(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      })
      .optional(),
    location: locationSchema.optional(),
    status: Joi.string().valid(...Object.values(PUMP_STATUS)).default(PUMP_STATUS.ACTIVE),
    settings: Joi.object().optional(),
    timezone: Joi.string().trim().default('Asia/Kolkata'),
    currency: Joi.string().trim().length(3).uppercase().default('INR'),
    pumpImages: Joi.array().items(Joi.string().trim().allow('')).optional(),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    code: Joi.string().trim().min(2).max(20).uppercase().optional(),
    managerId: Joi.string()
      .trim()
      .allow('', null)
      .custom((value, helpers) => {
        // If empty string, convert to null
        if (value === '') {
          return null;
        }
        // If provided, validate it's a valid MongoDB ObjectId (24 hex chars)
        if (value && !/^[0-9a-fA-F]{24}$/.test(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      })
      .optional(),
    location: locationSchema.optional(),
    status: Joi.string().valid(...Object.values(PUMP_STATUS)).optional(),
    settings: Joi.object().optional(),
    timezone: Joi.string().trim().optional(),
    currency: Joi.string().trim().length(3).uppercase().optional(),
    pumpImages: Joi.array().items(Joi.string().trim().allow('')).optional(),
  }).min(1),
};
