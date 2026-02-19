import mongoose from 'mongoose';
import { config } from './index.js';
import { seedAdmin } from '../seeders/seedAdmin.js';

const connectDB = async () => {
  try {
    if (!config.mongoUri) {
      throw new Error('MONGODB_URI or MONGODB_URI_TEST is not set in .env');
    }

    const connectionInstance = await mongoose.connect(config.mongoUri, {
      dbName: config.dbName,
    });
    console.log(`MongoDB connected! DB Host: ${connectionInstance.connection.host}`);
    console.log(`Database: ${config.dbName}`);

    // Run seeding after connection
    await seedAdmin();

  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;
