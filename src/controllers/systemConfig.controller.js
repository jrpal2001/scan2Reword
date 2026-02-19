import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { systemConfigService } from '../services/systemConfig.service.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * GET /api/admin/config
 * Get system configuration (admin only)
 */
export const getConfig = asyncHandler(async (req, res) => {
  const config = await systemConfigService.getConfig();
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(config, 'System configuration retrieved')
  );
});

/**
 * PUT /api/admin/config
 * Update system configuration (admin only)
 */
export const updateConfig = asyncHandler(async (req, res) => {
  const config = await systemConfigService.updateConfig(req.validated);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(config, 'System configuration updated')
  );
});
