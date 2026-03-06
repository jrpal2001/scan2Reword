import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToDocument } from '../utils/dateUtils.js';
import { managerService } from '../services/manager.service.js';
import { pumpService } from '../services/pump.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/manager/profile
 * Get current manager's profile (from JWT).
 */
export const getProfile = asyncHandler(async (req, res) => {
  const profile = await managerService.getProfile(req.user._id);
  const withIST = addISTToDocument(profile);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(withIST, 'Manager profile retrieved')
  );
});

/**
 * PATCH /api/manager/profile
 * Update current manager's profile (fullName, email, address, profilePhoto).
 * Optional multipart: profilePhoto file; or send profilePhoto URL in body.
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const data = { ...(req.validated || {}) };
  const uploadedUrl = req.s3Uploads?.profilePhoto?.[0];
  if (uploadedUrl) data.profilePhoto = uploadedUrl;

  const profile = await managerService.updateProfile(req.user._id, data);
  const withIST = addISTToDocument(profile);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(withIST, 'Manager profile updated')
  );
});

/**
 * GET /api/manager/pumps
 * List pumps assigned to the current manager (pumps where managerId = current manager).
 * Query: page?, limit?, status?
 */
export const listMyPumps = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = { managerId: req.user._id };
  if (status) filter.status = status;

  const result = await pumpService.listPumps(filter, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 10,
  });
  return res.sendPaginated(result, 'Assigned pumps retrieved', HTTP_STATUS.OK);
});
