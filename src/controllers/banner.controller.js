import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToDocument } from '../utils/dateUtils.js';
import { bannerService } from '../services/banner.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/banners
 * Query: pumpId? (optional), page? (optional), limit? (optional)
 * Public endpoint - returns active banners (startTime ≤ now and endTime > now)
 */
export const getActiveBanners = asyncHandler(async (req, res) => {
  const { pumpId = null, page = 1, limit = 10 } = req.validated || req.query;
  const result = await bannerService.getActiveBanners(pumpId || null, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });
  return res.sendPaginated(result, 'Active banners retrieved', HTTP_STATUS.OK);
});

/**
 * POST /api/admin/banners or POST /api/manager/banners
 * Body: form-data or JSON. Fields: title, description?, imageUrl? (file or URL), linkUrl?, startTime, endTime, pumpIds?, status?
 * If imageUrl is sent as a file, it is uploaded to S3 (banners/) and the URL is used.
 * Admin/Manager only.
 */
export const createBanner = asyncHandler(async (req, res) => {
  const data = { ...req.validated };
  const uploadedUrl = req.s3Uploads?.imageUrl?.[0];
  if (uploadedUrl) data.imageUrl = uploadedUrl;

  const role = (req.userType || req.user?.role || '').toLowerCase();
  const banner = await bannerService.createBanner(
    data,
    req.user._id,
    role,
    req.allowedPumpIds
  );
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(addISTToDocument(banner), 'Banner created successfully')
  );
});

/**
 * PATCH /api/admin/banners/:bannerId or PATCH /api/manager/banners/:bannerId
 * Body: form-data or JSON (partial). imageUrl can be file (uploaded to S3) or URL string.
 * Admin/Manager only.
 */
export const updateBanner = asyncHandler(async (req, res) => {
  const { bannerId } = req.params;
  const data = { ...req.validated };
  const uploadedUrl = req.s3Uploads?.imageUrl?.[0];
  if (uploadedUrl) data.imageUrl = uploadedUrl;

  const role = (req.userType || req.user?.role || '').toLowerCase();
  const banner = await bannerService.updateBanner(
    bannerId,
    data,
    req.user._id,
    role,
    req.allowedPumpIds
  );
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToDocument(banner), 'Banner updated successfully')
  );
});

/**
 * DELETE /api/admin/banners/:bannerId or DELETE /api/manager/banners/:bannerId
 * Admin/Manager only.
 */
export const deleteBanner = asyncHandler(async (req, res) => {
  const { bannerId } = req.params;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  await bannerService.deleteBanner(bannerId, req.user._id, role);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(null, 'Banner deleted successfully')
  );
});

/**
 * GET /api/admin/banners/:bannerId or GET /api/manager/banners/:bannerId
 * Admin/Manager only.
 */
export const getBannerById = asyncHandler(async (req, res) => {
  const { bannerId } = req.params;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const banner = await bannerService.getBannerById(
    bannerId,
    req.user._id,
    role,
    req.allowedPumpIds
  );
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToDocument(banner), 'Banner retrieved')
  );
});

/**
 * GET /api/admin/banners or GET /api/manager/banners
 * Query: page?, limit?, status?, pumpId?
 * Admin/Manager only.
 */
export const listBanners = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, pumpId } = req.query;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  
  const filter = {};
  if (status) filter.status = status;
  if (pumpId) filter.pumpIds = pumpId;

  const result = await bannerService.listBanners(
    filter,
    {
      page: parseInt(page),
      limit: parseInt(limit),
    },
    req.user._id,
    role,
    req.allowedPumpIds
  );
  return res.sendPaginated(result, 'Banners retrieved', HTTP_STATUS.OK);
});
