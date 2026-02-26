import { asyncHandler } from '../utils/asyncHandler.js';
import { putObject } from '../utils/Aws/putObject.js';
import { compressMulterFile } from '../utils/imageCompressor.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';
import path from 'path';

/**
 * Generic AWS S3 upload middleware
 * Uploads files from req.files (multer) to S3 and attaches URLs to req.s3Uploads
 * @param {string} folder - S3 folder path (e.g., 'transactions', 'users', 'vehicles')
 */
export const uploadToS3 = (folder = 'uploads') =>
  asyncHandler(async (req, res, next) => {
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      req.s3Uploads = {};
      return next();
    }

    try {
      // req.files can be: array (from upload.any() in formDataParser) or object (from upload.fields() in route)
      let filesByField = {};
      if (Array.isArray(req.files)) {
        for (const file of req.files) {
          const name = file.fieldname || 'file';
          if (!filesByField[name]) filesByField[name] = [];
          filesByField[name].push(file);
        }
      } else if (req.files && typeof req.files === 'object') {
        for (const [fieldName, fileArray] of Object.entries(req.files)) {
          if (Array.isArray(fileArray)) filesByField[fieldName] = fileArray;
        }
      }

      if (Object.keys(filesByField).length === 0) {
        req.s3Uploads = {};
        return next();
      }

      const uploadsObj = {};
      for (const [fieldName, fileArray] of Object.entries(filesByField)) {
        const fieldUploads = [];
        for (const file of fileArray) {
          const compressedFile = await compressMulterFile(file);
          const ext = path.extname(compressedFile.originalname) || '';
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const s3Key = `${folder}/${fieldName}-${timestamp}-${random}${ext}`;
          const { url } = await putObject(compressedFile, s3Key);
          fieldUploads.push(url);
        }
        uploadsObj[fieldName] = fieldUploads; // Always array for consistent API
      }
      req.s3Uploads = uploadsObj;
      next();
    } catch (error) {
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'File upload failed', error.message);
    }
  });
