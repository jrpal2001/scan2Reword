import Joi from 'joi';

const mobileSchema = Joi.string().trim().pattern(/^[6-9]\d{9}$/).required().messages({
  'string.pattern.base': 'Mobile must be a valid 10-digit Indian number',
});

const VEHICLE_TYPES = ['Two-Wheeler', 'Three-Wheeler', 'Four-Wheeler', 'Commercial'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric'];

/** Normalize vehicleType: "Four Wheeler" -> "Four-Wheeler", etc. */
function normalizeVehicleType(v) {
  if (typeof v !== 'string' || !v.trim()) return v;
  const trimmed = v.trim().replace(/\s+/g, '-');
  const match = VEHICLE_TYPES.find((t) => t.replace(/-/g, '').toLowerCase() === trimmed.replace(/-/g, '').toLowerCase());
  return match || trimmed;
}

const vehicleSchema = Joi.object({
  vehicleNumber: Joi.string().trim().required(),
  vehicleType: Joi.string()
    .valid(...VEHICLE_TYPES)
    .required()
    .messages({ 'any.only': `vehicleType must be one of: ${VEHICLE_TYPES.join(', ')}` }),
  fuelType: Joi.string()
    .valid(...FUEL_TYPES)
    .required()
    .messages({ 'any.only': `fuelType must be one of: ${FUEL_TYPES.join(', ')}` }),
  brand: Joi.string().trim().allow('').optional(),
  model: Joi.string().trim().allow('').optional(),
  yearOfManufacture: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
  rcPhoto: Joi.string().trim().allow('', null).optional(),
  insurancePhoto: Joi.string().trim().allow('', null).optional(),
  fitnessPhoto: Joi.string().trim().allow('', null).optional(),
  pollutionPhoto: Joi.string().trim().allow('', null).optional(),
  vehiclePhoto: Joi.array().items(Joi.string().trim()).optional(),
});

/** Parse JSON string; form-data often sends vehicle as a string. */
function parseJsonRelaxed(str) {
  if (typeof str !== 'string' || !str.trim()) return undefined;
  try {
    return JSON.parse(str);
  } catch (e) {
    const repaired = str.replace(/([,{])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    try {
      return JSON.parse(repaired);
    } catch (e2) {
      throw e;
    }
  }
}

const VEHICLE_ERR = `vehicle must include vehicleNumber, vehicleType (${VEHICLE_TYPES.join(', ')}), fuelType (${FUEL_TYPES.join(', ')})`;

/** Vehicle: object or JSON string (form-data). Normalizes vehicleType (e.g. "Four Wheeler" -> "Four-Wheeler"). */
function validateAndNormalizeVehicle(value, helpers) {
  if (value === undefined || value === null || value === '') return undefined;
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = parseJsonRelaxed(value);
    } catch (e) {
      return helpers.error('any.custom', { message: 'vehicle must be valid JSON with vehicleNumber, vehicleType, fuelType' });
    }
  }
  if (!parsed || typeof parsed !== 'object') return helpers.error('any.custom', { message: 'vehicle must be an object or JSON string' });
  const normalized = { ...parsed, vehicleType: normalizeVehicleType(parsed.vehicleType || '') };
  const { error, value: out } = vehicleSchema.validate(normalized);
  if (error) {
    const firstMsg = error.details?.[0]?.message;
    const msg = (typeof firstMsg === 'string' && firstMsg.trim()) ? firstMsg.trim() : VEHICLE_ERR;
    return helpers.error('any.custom', { message: msg || VEHICLE_ERR });
  }
  return out;
}

const vehicleSchemaOrString = Joi.alternatives().try(
  Joi.object().custom(validateAndNormalizeVehicle),
  Joi.string().trim().custom(validateAndNormalizeVehicle),
  vehicleSchema
);

const addressObjectSchema = Joi.object({
  street: Joi.string().trim().allow('').optional(),
  city: Joi.string().trim().allow('').optional(),
  state: Joi.string().trim().allow('').optional(),
  pincode: Joi.string().trim().allow('').optional(),
});

/** Address: object or JSON string (form-data sends as string). */
const addressSchemaOrString = Joi.alternatives().try(
  addressObjectSchema,
  Joi.string().trim().custom((value, helpers) => {
    if (!value) return undefined;
    try {
      const parsed = typeof value === 'string' ? parseJsonRelaxed(value) : value;
      const { error, value: out } = addressObjectSchema.validate(parsed);
      if (error) return helpers.error('any.invalid');
      return out;
    } catch (e) {
      return helpers.error('any.invalid');
    }
  })
);

const ownerObjectSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required(),
  mobile: mobileSchema,
  email: Joi.string().email().trim().lowercase().allow('').optional(),
  address: addressObjectSchema.optional(),
});

/** Owner: object or JSON string (multipart/form-data sends as string) */
const ownerSchemaOrString = Joi.alternatives().try(
  ownerObjectSchema,
  Joi.string().trim().custom((value, helpers) => {
    if (!value) return undefined;
    try {
      const parsed = typeof value === 'string' ? parseJsonRelaxed(value) : value;
      const { error, value: out } = ownerObjectSchema.validate(parsed);
      if (error) return helpers.error('any.invalid');
      return out;
    } catch (e) {
      return helpers.error('any.invalid');
    }
  })
);

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
    fcmToken: Joi.string().trim().allow('', null).optional(),
    deviceInfo: Joi.object({
      deviceId: Joi.string().trim().allow('', null).optional(),
      deviceName: Joi.string().trim().allow('', null).optional(),
      platform: Joi.string().valid('ios', 'android', 'web').allow('', null).optional(),
      appVersion: Joi.string().trim().allow('', null).optional(),
    }).optional(),
  }),

  verifyPassword: Joi.object({
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

  setPassword: Joi.object({
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters',
    }),
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
    accountType: Joi.string().trim().lowercase().valid('individual', 'organization').required(),
    /** When true, create only fleet owner (no driver, no vehicle). Requires organization + non-registered owner. */
    ownerOnly: Joi.boolean().optional(),
    // Individual registration (optional when ownerOnly)
    mobile: Joi.when('ownerOnly', { is: true, then: Joi.optional(), otherwise: mobileSchema }),
    fullName: Joi.when('ownerOnly', { is: true, then: Joi.optional(), otherwise: Joi.string().trim().min(2).max(100).required() }),
    email: Joi.string().email().trim().lowercase().allow('').optional(),
    referralCode: Joi.string().trim().allow('').optional(),
    /** Pump where user is registering: send pump Mongo _id or pump code (e.g. "PMP002"). Stored as registeredPumpId. */
    registeredPumpId: Joi.string().hex().length(24).allow('', null).optional(),
    registeredPumpCode: Joi.string().trim().allow('', null).optional(),
    address: addressSchemaOrString.optional(),
    // vehicle: object, JSON string, or omit and use flat fields below (form-data)
    vehicle: Joi.when('ownerOnly', { is: true, then: Joi.forbidden(), otherwise: vehicleSchemaOrString.optional() }),
    // Flat vehicle fields (when sending form-data with vehicleNumber, vehicleType, fuelType as separate fields)
    vehicleNumber: Joi.string().trim().optional(),
    vehicleType: Joi.string().valid('Two-Wheeler', 'Three-Wheeler', 'Four-Wheeler', 'Commercial').optional(),
    fuelType: Joi.string().valid('Petrol', 'Diesel', 'CNG', 'Electric').optional(),
    brand: Joi.string().trim().allow('').optional(),
    model: Joi.string().trim().allow('').optional(),
    yearOfManufacture: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
    rcPhoto: Joi.string().trim().allow('', null).optional(),
    insurancePhoto: Joi.string().trim().allow('', null).optional(),
    fitnessPhoto: Joi.string().trim().allow('', null).optional(),
    pollutionPhoto: Joi.string().trim().allow('', null).optional(),
    vehiclePhoto: Joi.alternatives().try(Joi.array().items(Joi.string().trim()), Joi.string().trim()).optional(),
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
      then: ownerSchemaOrString.required(),
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
  }).custom((value, helpers) => {
    if (value.ownerOnly) return value;
    if (value.vehicle) return value;
    if (value.vehicleNumber && value.vehicleType && value.fuelType) {
      value.vehicle = {
        vehicleNumber: value.vehicleNumber,
        vehicleType: value.vehicleType,
        fuelType: value.fuelType,
        brand: value.brand || '',
        model: value.model || '',
        yearOfManufacture: value.yearOfManufacture,
        rcPhoto: value.rcPhoto || null,
        insurancePhoto: value.insurancePhoto || null,
        fitnessPhoto: value.fitnessPhoto || null,
        pollutionPhoto: value.pollutionPhoto || null,
        vehiclePhoto: value.vehiclePhoto,
      };
      const { error } = vehicleSchema.validate(value.vehicle);
      if (error) return helpers.error('any.invalid');
      return value;
    }
    return helpers.error('any.custom', { message: 'vehicle is required: send vehicle (object or JSON string) or vehicleNumber, vehicleType, fuelType' });
  }),
};
