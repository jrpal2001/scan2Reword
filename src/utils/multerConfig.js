import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/svg+xml',
    'image/heic',
    'image/heif',
    'image/avif',
    'image/x-icon',
  // Documents
    'application/pdf',

    // Added video support
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WEBP, GIF, BMP, TIFF, SVG, HEIC, HEIF, AVIF, ICO, PDF, MP4, WEBM, and MOV files are allowed'), false);
  }
};

// 50MB max per file to avoid RAM spikes (e.g. 10 users × 50MB = 500MB)
const FILE_SIZE_LIMIT = 50 * 1024 * 1024;

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

/** Banner image (single) – uploads to S3, stored as imageUrl */
export const bannerUploadFields = [{ name: 'imageUrl', maxCount: 1 }];

/** Onboarding: multiple images in one doc (create/update use same field) */
export const onboardingUploadFields = [{ name: 'images', maxCount: 10 }];

/** Profile avatar only (PATCH /api/user/profile) */
export const profileUpdateFields = [{ name: 'profilePhoto', maxCount: 1 }];