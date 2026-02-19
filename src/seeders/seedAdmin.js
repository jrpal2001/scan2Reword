// seedAdmin.js
import Admin from '../models/Admin.js';
import { config } from '../config/index.js';

export const seedAdmin = async () => {
  try {
    const adminEmail = config.admin.email;
    const existingAdmin = await Admin.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const newAdmin = new Admin({
        name: config.admin.name,
        email: adminEmail,
        phone: config.admin.phone,
        password: config.admin.password, // Will be auto-hashed due to pre-save hook
      });

      await newAdmin.save();
      console.log(`✅ Default Admin created: ${adminEmail} / ${config.admin.password}`);
    } else {
      console.log('ℹ️ Admin already exists, skipping seeding.');
    }
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  }
};
