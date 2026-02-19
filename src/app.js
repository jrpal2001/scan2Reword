import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import managerRoutes from './routes/manager.routes.js';
import staffRoutes from './routes/staff.routes.js';
import authRoutes from './routes/auth.routes.js';
import scanRoutes from './routes/scan.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import bannerRoutes from './routes/banner.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { config } from './config/index.js';

dotenv.config();

const app = express();

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = config.cors?.origins || process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [
        'http://localhost:3000',
        'http://localhost:5173',
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Middleware
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// API base path
app.use('/api/auth', authRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/banners', bannerRoutes);

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