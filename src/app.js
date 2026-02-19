import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables FIRST before importing config
dotenv.config();

import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import managerRoutes from './routes/manager.routes.js';
import staffRoutes from './routes/staff.routes.js';
import authRoutes from './routes/auth.routes.js';
import scanRoutes from './routes/scan.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import bannerRoutes from './routes/banner.routes.js';
import rewardRoutes from './routes/reward.routes.js';
import redemptionRoutes from './routes/redemption.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import ownerRoutes from './routes/owner.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { formDataParser } from './middlewares/formDataParser.js';
import { rateLimiter } from './middlewares/rateLimiter.middleware.js';
import { config } from './config/index.js';

const app = express();

// VERY EARLY Request logging middleware (for debugging) - MUST BE FIRST
app.use((req, res, next) => {
  console.log('='.repeat(50));
  console.log(`[REQUEST RECEIVED] ${req.method} ${req.path}`);
  console.log('Headers:', {
    origin: req.headers.origin,
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent']?.substring(0, 50),
    host: req.headers.host,
  });
  console.log('Body:', req.body);
  console.log('='.repeat(50));
  next();
});

// CORS - Allow all origins in development, restrict in production
app.use(
  cors({
    origin: (origin, callback) => {
      console.log('[CORS] Checking origin:', { origin, nodeEnv: config.nodeEnv });
      // Allow requests with no origin (like Postman, mobile apps, curl)
      if (!origin) {
        console.log('[CORS] No origin, allowing request');
        return callback(null, true);
      }
      
      const allowedOrigins = config.cors.origins;
      
      // In development, allow all origins for easier testing
      if (config.nodeEnv === 'development') {
        console.log('[CORS] Development mode, allowing all origins');
        return callback(null, true);
      }
      
      // In production, check against allowed origins
      if (allowedOrigins.includes(origin)) {
        console.log('[CORS] Origin allowed');
        callback(null, true);
      } else {
        console.warn(`[CORS] Origin "${origin}" not allowed. Allowed origins:`, allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Middleware
// JSON and URL-encoded body parsers (for application/json and application/x-www-form-urlencoded)
// IMPORTANT: These must come BEFORE formDataParser for JSON requests
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// Log after body parsing
app.use((req, res, next) => {
  console.log('[After Body Parsing]', {
    method: req.method,
    path: req.path,
    body: req.body,
    'content-type': req.headers['content-type'],
  });
  next();
});

// Form-data parser (for POST/PATCH requests with multipart/form-data)
app.use(formDataParser);

// Rate limiting (global - applies to all routes) - COMMENTED OUT FOR DEBUGGING
// app.use(rateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 100 })); // 100 requests per 15 minutes per IP

// API base path
console.log('[App] Registering routes...');
app.use('/api/auth', authRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', (req, res, next) => {
  console.log('[App] Admin route matched:', req.method, req.path);
  next();
}, adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/redeem', redemptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/owner', ownerRoutes);
console.log('[App] All routes registered');

// Health check (for liveness/readiness)
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});

// Test Route
app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is working! 🚀',
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler (Controller → Service → Repository pattern)
app.use(errorHandler);

export default app;