import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import ApiError from './utils/ApiError.js';

dotenv.config();

const app = express();

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [
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

// Routes
   app.use('/user', userRoutes);
   app.use('/admin', adminRoutes);
// Test Route
app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is working! 🚀',
    timestamp: new Date().toISOString(),
  });
});

// Basic Error Handler
app.use((err, req, res, next) => {
 

  // If it's an instance of ApiError → use its structure
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Otherwise, fallback to generic
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    data: null,
  });
});

export default app;