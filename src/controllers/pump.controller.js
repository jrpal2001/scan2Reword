import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { pumpService } from '../services/pump.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * POST /api/admin/pumps
 * Body: req.validated (name, code, managerId?, location?, status?, ...)
 * Admin only.
 */
export const createPump = asyncHandler(async (req, res) => {
  const pump = await pumpService.createPump(req.validated, req.user._id);
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(pump, 'Pump created successfully')
  );
});

/**
 * PUT /api/admin/pumps/:pumpId
 * Body: req.validated (partial pump fields)
 * Admin only.
 */
export const updatePump = asyncHandler(async (req, res) => {
  const { pumpId } = req.params;
  const pump = await pumpService.updatePump(pumpId, req.validated, req.user._id);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(pump, 'Pump updated successfully')
  );
});

/**
 * DELETE /api/admin/pumps/:pumpId
 * Admin only.
 */
export const deletePump = asyncHandler(async (req, res) => {
  const { pumpId } = req.params;
  await pumpService.deletePump(pumpId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(null, 'Pump deleted successfully')
  );
});

/**
 * GET /api/admin/pumps/:pumpId
 * Admin only.
 */
export const getPumpById = asyncHandler(async (req, res) => {
  const { pumpId } = req.params;
  const pump = await pumpService.getPumpById(pumpId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(pump, 'Pump retrieved')
  );
});

/**
 * GET /api/admin/pumps
 * Query: page?, limit?, status?, managerId?
 * Admin only.
 */
export const listPumps = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, managerId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (managerId) filter.managerId = managerId;

  const result = await pumpService.listPumps(filter, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result, 'Pumps retrieved')
  );
});
