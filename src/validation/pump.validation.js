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
    code: Joi.string().trim().min(2).max(20).uppercase().required(),
    managerId: Joi.string().hex().length(24).allow(null).optional(),
    location: locationSchema.optional(),
    status: Joi.string().valid(...Object.values(PUMP_STATUS)).default(PUMP_STATUS.ACTIVE),
    settings: Joi.object().optional(),
    timezone: Joi.string().trim().default('Asia/Kolkata'),
    currency: Joi.string().trim().length(3).uppercase().default('INR'),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    code: Joi.string().trim().min(2).max(20).uppercase().optional(),
    managerId: Joi.string().hex().length(24).allow(null).optional(),
    location: locationSchema.optional(),
    status: Joi.string().valid(...Object.values(PUMP_STATUS)).optional(),
    settings: Joi.object().optional(),
    timezone: Joi.string().trim().optional(),
    currency: Joi.string().trim().length(3).uppercase().optional(),
  }).min(1),
};
