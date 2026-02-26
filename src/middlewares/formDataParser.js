/**
 * App-level form-data: do NOT parse multipart here.
 * Multipart is parsed per-route with upload.fields(...) so each route defines allowed fields.
 * This middleware is kept for backwards compatibility (no-op for multipart).
 */
export const formDataParser = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    // Let route-level multer handle it (upload.fields on each route)
    return next();
  }
  next();
};
