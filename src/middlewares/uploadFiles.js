import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadMultipleToCloudinary } from '../utils/uploadCloudinary.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Middleware to upload files from req.files (multer) to Cloudinary
 * Attaches req.uploadedFiles array of URLs
 */
export const uploadFilesToCloudinary = asyncHandler(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    req.uploadedFiles = [];
    return next();
  }

  try {
    const urls = await uploadMultipleToCloudinary(req.files, 'transactions');
    req.uploadedFiles = urls;
    next();
  } catch (error) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'File upload failed', error.message);
  }
});
