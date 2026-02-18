import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import userService from "../services/user.service.js";
import userValidator from "../validation/user.validator.js";
import User from '../models/user.js';
import { uploadSingleToCloudinary, uploadMultipleToCloudinary } from '../utils/uploadCloudinary.js';





// ✅ Get user by ID
const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const data = await userService.getUserById(userId);
  res.status(200).json(ApiResponse.success(data, "User details fetched successfully"));
});

// ✅ Update user profile by ID
const updateProfileByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { error, value } = userValidator.updateProfile.validate(req.body, { abortEarly: false });
  if (error) throw new ApiError(400, "Validation failed", error.details.map(e => e.message));

  await userService.updateProfileByUserId(userId, value);
  res.status(200).json(ApiResponse.success(null, "Profile updated successfully"));
});

// ✅ Get all plans (Ag, SIP, One-Time) bought by user ID
const getAllPlansBoughtByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) throw new ApiError(400, "User ID is required");

  const data = await userService.getAllPlansBoughtByUserId(userId);

  res
    .status(200)
    .json(ApiResponse.success(data, "All plans fetched successfully"));
});



    export default {

  getUserById,
    updateProfileByUserId,
  getAllPlansBoughtByUserId,
};
