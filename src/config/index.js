/**
 * Central config (env-based). No secrets in code.
 * Load dotenv here to ensure it runs before config object is created.
 */
import dotenv from 'dotenv';
dotenv.config();

const productionModeRaw = (process.env.production || 'dev').trim().toLowerCase();
const isProductionModeValid = productionModeRaw === 'dev' || productionModeRaw === 'prod';
const productionMode = isProductionModeValid ? productionModeRaw : 'dev';
const mongoEnvKey = productionMode === 'prod' ? 'MONGODB_URI' : 'MONGODB_URI_TEST';
const mongoUri = process.env[mongoEnvKey] || '';

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const whatsappEnabledFromEnv = process.env.WHATSAPP_ENABLED;
const whatsappEnabled = whatsappEnabledFromEnv == null
  ? Boolean(process.env.WHATSAPP_API_KEY && process.env.WHATSAPP_API_CAMPAIGN_NAME)
  : String(whatsappEnabledFromEnv).trim().toLowerCase() === 'true';

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || (productionMode === 'prod' ? 'production' : 'development'),
  port: parseInt(process.env.PORT, 10) || 3000,
  productionModeRaw,
  productionMode,
  isProductionModeValid,
  mongoEnvKey,
  mongoUri,
  dbName: process.env.DB_NAME || 'scan2reward',

  jwt: {
    accessSecret: process.env.ACCESS_TOKEN_SECRET || 'default-change-in-env',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'default-change-in-env',
    accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || '24h',
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  },

  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10,
    length: parseInt(process.env.OTP_LENGTH, 10) || 6,
  },

  cors: {
    origins: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ],
  },

  admin: {
    name: process.env.ADMIN_NAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    phone: process.env.ADMIN_PHONE || '1234567890',
  },

  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    s3Bucket: process.env.AWS_S3_BUCKET || '',
    accessKeyId: process.env.AWS_ACCESS_KEY || '',
    secretAccessKey: process.env.AWS_SECRET_KEY || '',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  sms: {
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SENDER_ID || '',
    templateId: process.env.TEMPLATE_ID || '',
    baseUrl: process.env.SMS_BASE_URL || 'https://smsapi.edumarcsms.com/api/v1/sendsms',
    otpMessage: process.env.SMS_OTP_MESSAGE || null,
  },

  whatsapp: {
    enabled: whatsappEnabled,
    baseUrl: process.env.WHATSAPP_API_BASE_URL || 'https://backend.api-wa.co/campaign/combirds/api/v2',
    apiKey: process.env.WHATSAPP_API_KEY || '',
    campaignName: process.env.WHATSAPP_API_CAMPAIGN_NAME || '',
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91',
    sendConcurrency: parsePositiveInt(process.env.WHATSAPP_SEND_CONCURRENCY, 10),
    maxRetries: parsePositiveInt(process.env.WHATSAPP_MAX_RETRIES, 3),
  },

  email: {
    user: process.env.EMAIL_USER || '',
    appPassword: process.env.EMAIL_APP_PASSWORD || '',
    supportEmail: process.env.SUPPORT_EMAIL || '',
    fromEmail: process.env.FROM_EMAIL || process.env.EMAIL_USER || 'noreply@scen2reward.com',
    fromName: process.env.FROM_NAME || 'Scen2Reward',
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
    smtpSecure: process.env.SMTP_SECURE === 'true',
  },
});
