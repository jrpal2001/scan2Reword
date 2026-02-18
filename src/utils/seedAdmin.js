// seedAdmin.js
import Admin from '../models/Admin.js'; // Adjust path as per your structure

export const seedAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ email: 'admin@gmail.com' });
    if (!existingAdmin) {
      const newAdmin = new Admin({
        name: 'Super Admin',
        email: 'admin@gmail.com',
        phone: '9999999999', // Dummy phone, change if needed
        password: 'admin',  // Will be auto-hashed due to pre-save hook
      });

      await newAdmin.save();
      console.log('✅ Default Admin created: admin@gmail.com / admin');
    } else {
      console.log('ℹ️ Admin already exists, skipping seeding.');
    }
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  }
};
