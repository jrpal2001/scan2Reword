import mongoose from 'mongoose';
import { config } from './index.js';
import { seedAdmin } from '../seeders/seedAdmin.js';

const connectDB = async () => {
  try {
    if (!config.isProductionModeValid) {
      console.warn(
        `[DB] Invalid production mode "${config.productionModeRaw}". Falling back to "${config.productionMode}". Expected "dev" or "prod".`,
      );
    }

    if (!config.mongoUri) {
      throw new Error(`[DB] ${config.mongoEnvKey} is not set in .env for production="${config.productionMode}"`);
    }

    console.log(
      `[DB] Connecting to MongoDB | production="${config.productionMode}" | envKey="${config.mongoEnvKey}"`,
    );

    const connectionInstance = await mongoose.connect(config.mongoUri, {
      dbName: config.dbName,
    });
    console.log(`[DB] MongoDB connected | host="${connectionInstance.connection.host}" | db="${config.dbName}"`);

    mongoose.connection.on('error', (error) => {
      console.error('[DB] MongoDB runtime error:', error.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected');
    });

    // Run seeding after connection
    await seedAdmin();
  } catch (error) {
    console.error('[DB] MongoDB connection failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
};

export default connectDB;
