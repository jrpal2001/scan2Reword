import Joi from 'joi';

const objectIdSchema = Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/).required();

export const staffAssignmentValidation = {
  assign: Joi.object({
    staffId: objectIdSchema,
    pumpId: objectIdSchema,
  }),

  list: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    staffId: objectIdSchema.optional(),
    pumpId: objectIdSchema.optional(),
    status: Joi.string().valid('active', 'inactive').optional(),
  }),

  /** GET /api/admin/employee-list - list unassigned staff or managers. Search: partial match on fullName, mobile, email, staffCode (type=staff) or managerCode (type=manager). */
  unassigned: Joi.object({
    type: Joi.string().valid('staff', 'manager').required(),
    pumpId: Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    search: Joi.string().trim().max(200).allow('').optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};
