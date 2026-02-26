import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { bannerService } from '../services/banner.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/banners
 * Query: pumpId? (optional)
 * Public endpoint - returns active banners (startTime ≤ now and endTime > now)
 */
export const getActiveBanners = asyncHandler(async (req, res) => {
  const { pumpId } = req.query;
  const banners = await bannerService.getActiveBanners(pumpId || null);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(banners, 'Active banners retrieved')
  );
});

/**
 * POST /api/admin/banners or POST /api/manager/banners
 * Body: req.validated (banner data)
 * Admin/Manager only.
 */
export const createBanner = asyncHandler(async (req, res) => {
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const banner = await bannerService.createBanner(
    req.validated,
    req.user._id,
    role,
    req.allowedPumpIds
  );
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(banner, 'Banner created successfully')
  );
});

/**
 * PUT /api/admin/banners/:bannerId or PUT /api/manager/banners/:bannerId
 * Body: req.validated (partial banner data)
 * Admin/Manager only.
 */
export const updateBanner = asyncHandler(async (req, res) => {
  const { bannerId } = req.params;
  const role = (req.userType || req.user?.role || '').toLowerCase();
  const banner = await bannerService.updateBanner(
    bannerId,
    req.validated,
    req.user._id,
    role,
    req.allowedPumpIds
  );
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(banner, 'Banner updated successfully')
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
    ApiResponse.success(banner, 'Banner retrieved')
  );
});

/**
 * GET /api/admin/banners or GET /api/manager/banners
 * Query: page?, limit?, status?, pumpId?
 * Admin/Manager only.
 */
export const listBanners = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, pumpId } = req.query;
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
