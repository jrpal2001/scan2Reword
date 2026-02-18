import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from './ApiError.js';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a single file to Cloudinary
 * @param {Object} file - Multer file object
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string>} - Secure URL of the uploaded file
 */
export const uploadSingleToCloudinary = async (file, folder = 'aishwaryagold') => {
  try {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder },
        (error, result) => {
          if (error) {
            return reject(new ApiError(500, 'Cloudinary upload failed', error.message));
          }
          resolve(result.secure_url);
        }
      );
      stream.end(file.buffer);
    });
  } catch (error) {
    throw new ApiError(500, 'Cloudinary upload failed', error.message);
  }
};

/**
 * Upload multiple files to Cloudinary
 * @param {Object[]} files - Array of Multer file objects
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string[]>} - Array of secure URLs
 */
export const uploadMultipleToCloudinary = async (files, folder = 'aishwaryagold') => {
  try {
    const uploadPromises = files.map(file => uploadSingleToCloudinary(file, folder));
    return await Promise.all(uploadPromises);
  } catch (error) {
    throw new ApiError(500, 'Cloudinary upload failed', error.message);
  }
};