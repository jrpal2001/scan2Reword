import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { dashboardService } from '../services/dashboard.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/admin/dashboard
 * Admin dashboard with system-wide statistics
 */
export const getAdminDashboard = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getAdminDashboard();
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(stats, 'Admin dashboard statistics retrieved')
  );
});

/**
 * GET /api/manager/dashboard
 * Manager dashboard with pump-scoped statistics
 */
export const getManagerDashboard = asyncHandler(async (req, res) => {
  const pumpIds = req.allowedPumpIds || [];
  if (pumpIds.length === 0) {
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(
        {
          transactions: { today: 0, thisMonth: 0 },
          revenue: { today: 0, thisMonth: 0 },
          points: { issuedToday: 0, issuedThisMonth: 0 },
          redemptions: { today: 0, thisMonth: 0 },
        },
        'Manager dashboard statistics retrieved'
      )
    );
  }

  const stats = await dashboardService.getManagerDashboard(pumpIds);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(stats, 'Manager dashboard statistics retrieved')
  );
});

/**
 * GET /api/owner/fleet-aggregation
 * Get fleet owner aggregation (total fleet points and per-vehicle points)
 */
export const getFleetAggregation = asyncHandler(async (req, res) => {
  const ownerId = req.user._id.toString();
  const aggregation = await dashboardService.getFleetAggregation(ownerId);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(aggregation, 'Fleet aggregation retrieved')
  );
});
