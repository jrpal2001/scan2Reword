import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WEBP, and PDF files are allowed'), false);
  }
};

// 10MB max per file to avoid RAM spikes (e.g. 10 users × 10MB = 100MB, not 500MB)
const FILE_SIZE_LIMIT = 10 * 1024 * 1024;

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: FILE_SIZE_LIMIT },
});

/**
 * User-related file field names (profile, driver, owner, vehicle photos).
 * Used by upload.fields() so each route defines allowed fields.
 * uploadToS3 puts URL arrays in req.s3Uploads under these keys.
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

/** Transaction attachments only */
export const transactionUploadFields = [{ name: 'attachments', maxCount: 5 }];

/** Pump images (multiple) */
export const pumpUploadFields = [{ name: 'pumpImages', maxCount: 10 }];