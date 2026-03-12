import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { addISTToDocument, addISTToList } from '../utils/dateUtils.js';
import { onboardingService } from '../services/onboarding.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Admin: Create onboarding (one doc with multiple images). Expects multipart field "images" (max 10).
 */
export const createOnboarding = asyncHandler(async (req, res) => {
  const urls = req.s3Uploads?.images;
  if (!urls?.length) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'At least one image is required. Upload images in the "images" field.');
  }
  const item = await onboardingService.createWithImages(urls);
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(addISTToDocument(item), 'Onboarding created successfully')
  );
});

/**
 * Admin: List onboarding items (paginated), sorted by createdAt.
 */
export const listOnboarding = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.validated || req.query;
  const result = await onboardingService.list({}, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort: { createdAt: 1 },
  });
  const listWithIST = addISTToList(result.list || []);
  return res.sendPaginated(
    { ...result, list: listWithIST },
    'Onboarding list retrieved',
    HTTP_STATUS.OK
  );
});

/**
 * Admin: Get onboarding item by ID
 */
export const getOnboardingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await onboardingService.getById(id);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToDocument(item), 'Onboarding item retrieved')
  );
});

/**
 * Admin: Update onboarding (replace onboardImage array). Expects multipart field "images" (max 10).
 */
export const updateOnboarding = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const urls = req.s3Uploads?.images;
  if (!urls?.length) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'At least one image is required. Upload images in the "images" field.');
  }
  const item = await onboardingService.update(id, { onboardImage: urls });
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(addISTToDocument(item), 'Onboarding updated successfully')
  );
});

/**
 * Admin: Delete onboarding item
 */
export const deleteOnboarding = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await onboardingService.delete(id);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(null, 'Onboarding item deleted successfully')
  );
});

/**
 * Public: Get onboarding images list (no auth). Used by app for onboarding screens.
 */
export const getPublicOnboardingList = asyncHandler(async (req, res) => {
  const validated = req.validated || req.query;
  const limit = validated.limit ? parseInt(validated.limit) : 20;
  const list = await onboardingService.listActive(limit);
  const listWithIST = addISTToList(list);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success({ list: listWithIST }, 'Onboarding list retrieved')
  );
});
