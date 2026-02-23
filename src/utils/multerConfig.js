import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and PDF files are allowed'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit (matches global multerMiddleware)
});

/**
 * User-related file field names (profile, driver, owner, vehicle photos).
 * Used by upload.fields() so Multer knows which form fields to accept.
 * uploadToS3 then puts URLs in req.s3Uploads under these same keys.
 */
export const userUploadFields = [
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'driverPhoto', maxCount: 1 },
  { name: 'ownerPhoto', maxCount: 1 },
  { name: 'rcPhoto', maxCount: 1 },
  { name: 'insurancePhoto', maxCount: 1 },
  { name: 'fitnessPhoto', maxCount: 1 },
  { name: 'pollutionPhoto', maxCount: 1 },
  { name: 'vehiclePhoto', maxCount: 5 },
];