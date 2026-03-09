/**
 * For multipart form-data: remove any req.body value that is a file object (multer).
 * When a form field is sent as "File" in Postman by mistake, it can end up in req.body
 * and cause Joi to return "required" + "not allowed". Stripping it lets validation
 * see the field as missing and return a single clear "required" error.
 */
export const normalizeFormBody = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') return next();
  for (const key of Object.keys(req.body)) {
    const value = req.body[key];
    if (value && typeof value === 'object' && ('originalname' in value || 'buffer' in value)) {
      delete req.body[key];
    }
  }
  next();
};
