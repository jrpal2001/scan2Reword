import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import app from './src/app.js';
import { config } from './src/config/index.js';

dotenv.config();

const startServer = async () => {
  try {
    await connectDB();
    const port = config.port;
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${port} at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`💾 Database: ${config.dbName}`);
    });
  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
};

startServer();