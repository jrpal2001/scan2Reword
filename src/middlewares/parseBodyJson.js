/**
 * Parses JSON strings in req.body (for multipart requests where multer puts raw strings).
 * Run this AFTER route-level multer so req.body is already populated.
 * Use on any route that uses upload.fields() and sends nested objects (e.g. vehicle, owner) as JSON strings.
 */
export const parseBodyJson = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }
  Object.keys(req.body).forEach((key) => {
    const value = req.body[key];
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        req.body[key] = JSON.parse(value);
      } catch (e) {
        // Not valid JSON, keep as string
      }
    }
  });
  next();
};
