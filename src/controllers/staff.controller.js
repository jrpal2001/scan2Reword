import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToDocument } from '../utils/dateUtils.js';
import { staffService } from '../services/staff.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/staff/profile
 * Get current staff's profile (from JWT).
 */
export const getProfile = asyncHandler(async (req, res) => {
  const profile = await staffService.getProfile(req.user._id);
  const withIST = addISTToDocument(profile);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(withIST, 'Staff profile retrieved')
  );
});

/**
 * PATCH /api/staff/profile
 * Update current staff's profile (fullName, email, address, profilePhoto).
 * Optional multipart: profilePhoto file; or send profilePhoto URL in body.
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const data = { ...(req.validated || {}) };
  const uploadedUrl = req.s3Uploads?.profilePhoto?.[0];
  if (uploadedUrl) data.profilePhoto = uploadedUrl;

  const profile = await staffService.updateProfile(req.user._id, data);
  const withIST = addISTToDocument(profile);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(withIST, 'Staff profile updated')
  );
});
