import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToDocument } from '../utils/dateUtils.js';
import { pumpService } from '../services/pump.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * POST /api/admin/pumps
 * Body: req.validated (name, code, managerId? | managerIds?, location?, status?, pumpImages?).
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
    ApiResponse.success(addISTToDocument(pump), 'Pump created successfully')
  );
});

/**
 * PATCH /api/admin/pumps/:pumpId
 * Body: req.validated (partial pump fields). Files: pumpImages (multiple) via multipart.
 * pumpImages behavior:
 * - New files only → replace with new upload URLs.
 * - pumpImages in body only → set to that array (use [] to delete all).
 * - New files + pumpImages in body → merge: existing URLs from body + new file URLs (add new photos).
 * - Neither → leave pumpImages unchanged.
 * Admin only.
 */
export const updatePump = asyncHandler(async (req, res) => {
  const { pumpId } = req.params;
  const data = { ...req.validated };
  const uploaded = req.s3Uploads?.pumpImages;
  const bodyUrls = Array.isArray(req.validated?.pumpImages) ? req.validated.pumpImages.filter(Boolean) : [];

  if (Array.isArray(uploaded) && uploaded.length > 0) {
    // New uploads: merge with existing from body (add), or replace if body had no pumpImages
    data.pumpImages = [...bodyUrls, ...uploaded.filter(Boolean)];
  } else if (req.validated?.pumpImages !== undefined) {
    // No new files: set to body array (replace or delete all with [])
    data.pumpImages = bodyUrls;
  }
  const pump = await pumpService.updatePump(pumpId, data, req.user._id);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToDocument(pump), 'Pump updated successfully')
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
    ApiResponse.success(addISTToDocument(pump), 'Pump retrieved')
  );
});

/**
 * GET /api/admin/pumps
 * Query: page?, limit?, status?, managerId?, managerIds? (comma-separated or repeated)
 * Admin only.
 */
export const listPumps = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, managerId, managerIds } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (managerId) filter.managerId = managerId;
  if (managerIds) {
    const list = Array.isArray(managerIds)
      ? managerIds
      : String(managerIds).split(',').map((id) => id.trim());
    filter.managerIds = list.filter(Boolean);
  }

  const result = await pumpService.listPumps(filter, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return res.sendPaginated(result, 'Pumps retrieved', HTTP_STATUS.OK);
});

/**
 * GET /api/pumps (public, no auth)
 * Query: lat?, lng? (optional). When provided, each pump includes distanceKm and list is sorted by distance.
 */
export const getPublicPumpList = asyncHandler(async (req, res) => {
  const validated = req.validated || req.query;
  const lat = validated.lat != null ? Number(validated.lat) : null;
  const lng = validated.lng != null ? Number(validated.lng) : null;
  const search = validated.search != null ? String(validated.search).trim() : '';
  const result = await pumpService.getPublicPumpList(lat, lng, search);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result, 'Pumps retrieved')
  );
});

/**
 * GET /api/pumps/list (public, no auth)
 * Simple list of all active pumps: id, name, and code.
 */
export const getPublicPumpsBasicList = asyncHandler(async (req, res) => {
  const result = await pumpService.getPublicPumpsBasic();
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result.list, 'Pumps retrieved')
  );
});
