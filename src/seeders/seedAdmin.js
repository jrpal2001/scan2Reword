// seedAdmin.js
import Admin from '../models/Admin.js';
import dotenv from 'dotenv';

dotenv.config();

export const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
    const existingAdmin = await Admin.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const newAdmin = new Admin({
        name: process.env.ADMIN_NAME || 'Super Admin',
        email: adminEmail,
        phone: process.env.ADMIN_PHONE || '1234567890',
        password: process.env.ADMIN_PASSWORD || 'admin123', // Will be auto-hashed due to pre-save hook
      });

      await newAdmin.save();
      console.log(`✅ Default Admin created: ${adminEmail} / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    } else {
      console.log('ℹ️ Admin already exists, skipping seeding.');
    }
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  }
};
