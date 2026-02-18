import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import User from '../models/user.js';
import { userValidation } from '../validation/userValidation.js';
import { uploadSingleToCloudinary, uploadMultipleToCloudinary } from '../utils/uploadCloudinary.js';
import Joi from 'joi';
import otpModel from '../models/otp.model.js';
export const register = asyncHandler(async (req, res) => {


  // ✅ Phase 1: Validate required fields (name, phone) before uploads
  const basicSchema = Joi.object({
    name: userValidation.register.extract('name'),
    phone: userValidation.register.extract('phone'),
    email: userValidation.register.extract('email'), // optional
    pin: userValidation.register.extract('pin'), // optional
  });

  const { error: basicError, value: basicValue } = basicSchema.validate(req.body, { abortEarly: false });
  if (basicError) {
    throw new ApiError(400, 'Validation failed', basicError.details.map(e => e.message));
  }

  // ✅ Check if user with this phone already exists
  const existingUser = await User.findOne({ phone: basicValue.phone });
  console.log('✅ Existing user check (phone only):', existingUser);

  if (existingUser) {
    throw new ApiError(400, 'User with this phone number already exists');
  }

  // ✅ Phase 2: Upload optional files to Cloudinary
  let pancardUrls = [];
  let AadharcardUrl = null;
  let profileUrl = null;

  try {
    if (pancardFiles.length) {
      pancardUrls = await uploadMultipleToCloudinary(pancardFiles);
    }
    if (AadharcardFile) {
      AadharcardUrl = await uploadSingleToCloudinary(AadharcardFile);
    }
    if (profileFile) {
      profileUrl = await uploadSingleToCloudinary(profileFile);
    }

    console.log('✅ Files uploaded to Cloudinary:', { pancardUrls, AadharcardUrl, profileUrl });
  } catch (error) {
    console.error('Cloudinary upload error:', error.message);
    throw new ApiError(500, 'Failed to upload files to Cloudinary', error.message);
  }

  // ✅ Phase 3: Final validation with full schema
  const fullData = {
    ...basicValue,
    pancard: pancardUrls,
    Aadharcard: AadharcardUrl,
    profile: profileUrl,
  };

  const { error: finalError, value: finalValue } = userValidation.register.validate(fullData, { abortEarly: false });
  if (finalError) {
    console.error('Validation error after upload:', finalError.details);
    throw new ApiError(400, 'Validation failed', finalError.details.map(e => e.message));
  }

  // ✅ Save user
  const newUser = await User.create(finalValue);
  if (!newUser) {
    throw new ApiError(500, 'Failed to register user');
  }

  return res
    .status(201)
    .json(ApiResponse.success({ user: newUser._doc }, 'User registered successfully'));
});


