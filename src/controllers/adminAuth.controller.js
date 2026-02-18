import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import Admin from '../models/Admin.js';

// ✅ Admin Login Controller (Email + Password)

export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // ⚠ Validation
  if (!email || !password) {
    throw new ApiError(400, 'Email and Password are required');
  }

  // 🔍 Find Admin
  const admin = await Admin.findOne({ email });
  if (!admin) {
    throw new ApiError(404, 'Admin not found');
  }

  // 🔐 Compare Password
  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // 🎟 Generate Tokens
  const accessToken = admin.generateAccessToken();
  const refreshToken = admin.generateRefreshToken();

  // 💾 Save refreshToken to DB
  admin.refreshToken = refreshToken;
  await admin.save();

  // 🚫 Sanitize Response Data
  const safeAdminData = {
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    phone: admin.phone,
    userType: admin.userType,
    createdAt: admin.createdAt,
  };

  // 🍪 Set Secure Cookies
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
    sameSite: 'None', // Required if using cross-domain frontend
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'None',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // ✅ Send Response
  return res.status(200).json(
    ApiResponse.success(
      {
        user: safeAdminData,
        accessToken, 
        refreshToken, 
      },
      'Admin logged in successfully'
    )
  );
});