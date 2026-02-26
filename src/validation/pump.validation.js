import Joi from 'joi';
import { PUMP_STATUS } from '../constants/status.js';

// Coerce numeric strings/arrays from form-data (e.g. location[lat], location[lng]) to number
// Some parsers send lat/lng as arrays: { lat: ["17.5677"] }
const coerceNumber = (min, max) =>
  Joi.any().custom((value, helpers) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === null || raw === '') return undefined;
    const n = Number(raw);
    if (Number.isNaN(n)) return helpers.error('any.invalid');
    if (min != null && n < min) return helpers.error('number.min');
    if (max != null && n > max) return helpers.error('number.max');
    return n;
  }).optional();

const locationSchema = Joi.object({
  address: Joi.string().trim().allow('').optional(),
  city: Joi.string().trim().allow('').optional(),
  state: Joi.string().trim().allow('').optional(),
  pincode: Joi.string().trim().pattern(/^\d{6}$/).allow('').optional(),
  lat: coerceNumber(-90, 90),
  lng: coerceNumber(-180, 180),
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
