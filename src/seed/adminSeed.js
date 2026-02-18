// seedAdmin.js
import Admin from '../models/admin/Admin.js'; // Adjust path as per your structure

export const seedAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (!existingAdmin) {
      const newAdmin = new Admin({
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        phone: process.env.ADMIN_PHONE,
        password: process.env.ADMIN_PASSWORD,  // Will be auto-hashed due to pre-save hook
      });

      await newAdmin.save();
    } else {
    }
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  }
};
