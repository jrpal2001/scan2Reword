import Joi from 'joi';
import { TRANSACTION_STATUS } from '../constants/status.js';

export const transactionValidation = {
  create: Joi.object({
    pumpId: Joi.string().hex().length(24).required(),
    identifier: Joi.string().trim().min(1).required(),
    amount: Joi.number().positive().required(),
    liters: Joi.number().positive().allow(null).optional(),
    category: Joi.string().valid('Fuel', 'Lubricant', 'Store', 'Service').required(),
    billNumber: Joi.string().trim().min(1).required(),
    paymentMode: Joi.string().valid('Cash', 'Card', 'UPI', 'Wallet', 'Other').required(),
    campaignId: Joi.string().hex().length(24).allow(null).optional(),
    attachments: Joi.array().items(Joi.string().uri()).optional(),
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
  }),
};
