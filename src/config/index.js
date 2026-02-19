/**
 * Central config (env-based). No secrets in code.
 * Load dotenv in server.js / app.js before using.
 */
export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 8000,
  mongoUri: process.env.MONGODB_URI || '',
  dbName: process.env.DB_NAME || 'fuel_loyalty',

  jwt: {
    accessSecret: process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || 'default-change-in-env',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || 'default-change-in-env',
    accessExpiry: process.env.JWT_EXPIRY || process.env.ACCESS_TOKEN_EXPIRY || '24h',
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  },

  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10,
    length: parseInt(process.env.OTP_LENGTH, 10) || 6,
  },

  cors: {
    origins: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || ['http://localhost:3000', 'http://localhost:5173'],
  },
});
