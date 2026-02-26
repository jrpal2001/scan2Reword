import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Middleware to parse form-data (multipart/form-data) for POST/PATCH requests
 * Parses both file fields and text fields
 * Converts text fields to JSON in req.body for compatibility with existing controllers
 */
const storage = multer.memoryStorage();

// Accept all fields (files and text)
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * Form-data parser middleware
 * Parses multipart/form-data for ALL multipart requests (including paths that use uploadToS3).
 * Populates req.body (text) and req.files (array of { fieldname, originalname, buffer, ... }).
 * Routes then use req.body + req.files; uploadToS3 builds req.s3Uploads from req.files by fieldname.
 */
export const formDataParser = (req, res, next) => {
  // Only process POST, PUT, PATCH requests
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  // Check if content-type is multipart/form-data
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return next(); // Not form-data, let express.json handle it
  }

  // Parse multipart once so req.body and req.files are available to all routes (including staff/users, manager/users, admin/users)
  upload.any()(req, res, (err) => {
    if (err) {
      return next(err);
    }

    // Convert text fields from req.body (multer puts text fields there)
    // Parse JSON strings if they exist
    if (req.body) {
      Object.keys(req.body).forEach((key) => {
        const value = req.body[key];
        // Try to parse as JSON if it looks like JSON
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            req.body[key] = JSON.parse(value);
          } catch (e) {
            // Not valid JSON, keep as string
          }
        }
      });
    }

    next();
  });
};
