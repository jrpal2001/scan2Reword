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
 * Paths that use route-specific multer (upload.fields etc).
 * We must NOT parse multipart here so the stream is left for those routes.
 */
const MULTIPART_SKIP_PATHS = [
  '/api/auth/register',
  '/api/admin/users',
  '/api/manager/users',
  '/api/staff/users',
  '/api/owner/vehicles',
  '/api/transactions', // POST with attachments
];

/**
 * Form-data parser middleware
 * Parses multipart/form-data and converts text fields to req.body
 * File fields remain in req.files (handled by multer)
 * Skips parsing for paths that have their own multer to avoid "Unexpected end of form"
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

  // Skip parsing for routes that use their own multer (they consume the stream)
  const path = (req.originalUrl || req.url || req.path || '').split('?')[0];
  if (MULTIPART_SKIP_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    return next();
  }

  // Use multer to parse form-data
  // Accept any field names (both files and text)
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
