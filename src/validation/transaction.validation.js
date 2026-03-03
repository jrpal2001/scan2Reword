import Joi from 'joi';
import { TRANSACTION_STATUS } from '../constants/status.js';

export const transactionValidation = {
  create: Joi.object({
    pumpId: Joi.string().hex().length(24).optional(), // Optional for Staff (derived from their single pump assignment); required for Admin/Manager
    identifier: Joi.string().trim().min(1).required(),
    amount: Joi.number().min(0).optional(),
    liters: Joi.number().positive().allow(null).optional(),
    category: Joi.string().valid('Fuel', 'Lubricant', 'Store', 'Service').optional(),
    billNumber: Joi.string().trim().allow('').optional(),
    paymentMode: Joi.string().valid('Cash', 'Card', 'UPI', 'Wallet', 'Other').optional(),
    campaignId: Joi.string().hex().length(24).allow(null).optional(),
    attachments: Joi.array().items(Joi.string().uri()).optional(),
  }),

  /** PATCH /api/transactions/:transactionId - correct liters/amount; points recalculated, wallet adjusted (balance may go negative if user already spent). */
  update: Joi.object({
    liters: Joi.number().min(0).allow(null).optional(),
    amount: Joi.number().min(0).optional(),
  }).min(1).messages({
    'object.min': 'At least one of liters or amount is required to update',
  }),

  list: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    pumpId: Joi.string().hex().length(24).optional(),
    userId: Joi.string().hex().length(24).optional(),
    category: Joi.string().valid('Fuel', 'Lubricant', 'Store', 'Service').optional(),
    status: Joi.string().valid(...Object.values(TRANSACTION_STATUS)).optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    month: Joi.number().integer().min(1).max(12).optional(),
    year: Joi.number().integer().min(2000).max(2100).optional(),
    startTime: Joi.string().trim().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional(),
    endTime: Joi.string().trim().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).optional(),
  }),
};
