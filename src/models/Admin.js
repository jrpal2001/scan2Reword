import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  userType: { type: String, default: 'Admin' }, // fixed user type
  refreshToken: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

// ✅ Hash password before save
adminSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// ✅ Method to compare passwords
adminSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// ✅ Method to generate Access Token
adminSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, userType: this.userType },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '2d' }
  );
};

// ✅ Method to generate Refresh Token
adminSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, userType: this.userType },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
};

export default mongoose.model('Admin', adminSchema);
