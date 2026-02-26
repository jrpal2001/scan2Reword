import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { pumpService } from '../services/pump.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * POST /api/admin/pumps
 * Body: req.validated (name, code, managerId?, location?, status?, pumpImages?).
 * Files: pumpImages (multiple) via multipart; URLs in req.s3Uploads.pumpImages (array).
 * Admin only.
 */
export const createPump = asyncHandler(async (req, res) => {
  const data = { ...req.validated };
  const uploaded = req.s3Uploads?.pumpImages;
  if (Array.isArray(uploaded) && uploaded.length > 0) {
    data.pumpImages = uploaded.filter(Boolean);
  } else if (Array.isArray(req.validated?.pumpImages)) {
    data.pumpImages = req.validated.pumpImages.filter(Boolean);
  } else {
    data.pumpImages = [];
  }
  const pump = await pumpService.createPump(data, req.user._id);
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(pump, 'Pump created successfully')
  );
});

/**
 * PATCH /api/admin/pumps/:pumpId
 * Body: req.validated (partial pump fields). Files: pumpImages (multiple) via multipart.
 * If pumpImages uploaded, req.s3Uploads.pumpImages (array) overrides; else validated.pumpImages if provided.
 * Admin only.
 */
export const updatePump = asyncHandler(async (req, res) => {
  const { pumpId } = req.params;
  const data = { ...req.validated };
  const uploaded = req.s3Uploads?.pumpImages;
  if (Array.isArray(uploaded)) {
    data.pumpImages = uploaded.filter(Boolean);
  } else if (req.validated?.pumpImages !== undefined) {
    data.pumpImages = Array.isArray(req.validated.pumpImages) ? req.validated.pumpImages.filter(Boolean) : [];
  }
  const pump = await pumpService.updatePump(pumpId, data, req.user._id);
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
  return res.sendPaginated(result, 'Pumps retrieved', HTTP_STATUS.OK);
});
