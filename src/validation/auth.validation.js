import Joi from 'joi';

const mobileSchema = Joi.string().trim().pattern(/^[6-9]\d{9}$/).required().messages({
  'string.pattern.base': 'Mobile must be a valid 10-digit Indian number',
});

const vehicleSchema = Joi.object({
  vehicleNumber: Joi.string().trim().required(),
  vehicleType: Joi.string().valid('Two-Wheeler', 'Three-Wheeler', 'Four-Wheeler', 'Commercial').required(),
  fuelType: Joi.string().valid('Petrol', 'Diesel', 'CNG', 'Electric').required(),
  brand: Joi.string().trim().allow('').optional(),
  model: Joi.string().trim().allow('').optional(),
  yearOfManufacture: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
  rcPhoto: Joi.string().trim().allow('', null).optional(),
  insurancePhoto: Joi.string().trim().allow('', null).optional(),
  fitnessPhoto: Joi.string().trim().allow('', null).optional(),
  pollutionPhoto: Joi.string().trim().allow('', null).optional(),
  vehiclePhoto: Joi.array().items(Joi.string().trim()).optional(),
});

export const authValidation = {
  sendOtp: Joi.object({
    mobile: mobileSchema,
    purpose: Joi.string().valid('login', 'register').default('register'),
  }),

  verifyOtp: Joi.object({
    mobile: mobileSchema,
    otp: Joi.string().trim().min(4).max(8).required(),
    purpose: Joi.string().valid('login', 'register').default('register'),
  }),

  login: Joi.object({
    identifier: Joi.string().trim().min(1).required(),
    password: Joi.string().min(1).required(),
    fcmToken: Joi.string().trim().allow('', null).optional(),
    deviceInfo: Joi.object({
      deviceId: Joi.string().trim().allow('', null).optional(),
      deviceName: Joi.string().trim().allow('', null).optional(),
      platform: Joi.string().valid('ios', 'android', 'web').allow('', null).optional(),
      appVersion: Joi.string().trim().allow('', null).optional(),
    }).optional(),
  }),

  refresh: Joi.object({
    refreshToken: Joi.string().trim().required(),
  }),

  logout: Joi.object({
    // Optional: If provided, revokes specific refresh token (rarely needed)
    refreshToken: Joi.string().trim().allow('', null).optional(),
    // Recommended: FCM token identifies the device - revokes all tokens for that device
    fcmToken: Joi.string().trim().allow('', null).optional(),
    // If neither provided, logs out from all devices
  }),

  verifyOtp: Joi.object({
    mobile: mobileSchema,
    otp: Joi.string().trim().min(4).max(8).required(),
    purpose: Joi.string().valid('login', 'register').default('register'),
    fcmToken: Joi.string().trim().allow('', null).optional(),
    deviceInfo: Joi.object({
      deviceId: Joi.string().trim().allow('', null).optional(),
      deviceName: Joi.string().trim().allow('', null).optional(),
      platform: Joi.string().valid('ios', 'android', 'web').allow('', null).optional(),
      appVersion: Joi.string().trim().allow('', null).optional(),
    }).optional(),
  }),

  register: Joi.object({
    accountType: Joi.string().valid('individual', 'organization').required(),
    // Individual registration
    mobile: mobileSchema,
    fullName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().trim().lowercase().allow('').optional(),
    referralCode: Joi.string().trim().allow('').optional(),
    address: Joi.object({
      street: Joi.string().trim().allow('').optional(),
      city: Joi.string().trim().allow('').optional(),
      state: Joi.string().trim().allow('').optional(),
      pincode: Joi.string().trim().allow('').optional(),
    }).optional(),
    vehicle: vehicleSchema.required(),
    // Organization (Fleet) registration
    ownerType: Joi.when('accountType', {
      is: 'organization',
      then: Joi.string().valid('registered', 'non-registered').required(),
      otherwise: Joi.optional(),
    }),
    ownerIdentifier: Joi.when('ownerType', {
      is: 'registered',
      then: Joi.string().trim().required(),
      otherwise: Joi.optional(),
    }),
    owner: Joi.when('ownerType', {
      is: 'non-registered',
      then: Joi.object({
        fullName: Joi.string().trim().min(2).max(100).required(),
        mobile: mobileSchema,
        email: Joi.string().email().trim().lowercase().allow('').optional(),
        address: Joi.object({
          street: Joi.string().trim().optional(),
          city: Joi.string().trim().optional(),
          state: Joi.string().trim().optional(),
          pincode: Joi.string().trim().optional(),
        }).optional(),
      }).required(),
      otherwise: Joi.optional(),
    }),
    // FCM token and device info for multi-device support
    fcmToken: Joi.string().trim().allow('', null).optional(),
    deviceInfo: Joi.object({
      deviceId: Joi.string().trim().allow('', null).optional(),
      deviceName: Joi.string().trim().allow('', null).optional(),
      platform: Joi.string().valid('ios', 'android', 'web').allow('', null).optional(),
      appVersion: Joi.string().trim().allow('', null).optional(),
    }).optional(),
  }),
};
