import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables FIRST before importing any config
dotenv.config();

// Debug: where this file lives (helps fix Render path issues)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log('[server.js] Running from directory:', __dirname);
console.log('[server.js] CWD:', process.cwd());

import connectDB from './src/config/db.js';
import app from './src/app.js';
import { config } from './src/config/index.js';
import { startPointsExpiryJobs } from './src/jobs/pointsExpiry.job.js';

const startServer = async () => {
  try {
    await connectDB();
    const port = config.port;
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${port} at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`💾 Database: ${config.dbName}`);
      
      // Start cron jobs for points expiry
      try {
        startPointsExpiryJobs();
      } catch (error) {
        console.error('⚠️ Failed to start points expiry jobs:', error.message);
      }
    });
  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
};

startServer();