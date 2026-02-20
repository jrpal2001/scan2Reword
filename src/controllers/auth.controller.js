import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { authService } from '../services/auth.service.js';
import { userService } from '../services/user.service.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * POST /api/auth/send-otp
 * Body: { mobile, purpose? }
 */
export const sendOtp = asyncHandler(async (req, res) => {
  const value = req.validated;
  const result = await authService.sendOtp(value.mobile, value.purpose);
  return res.status(HTTP_STATUS.OK).json(ApiResponse.success(result, result.message));
});

/**
 * POST /api/auth/verify-otp
 * Body: { mobile, otp, purpose? }
 * Returns JWT + user if mobile already registered (login); else { user: null, token: null } for registration flow.
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const value = req.validated;
  const result = await authService.verifyOtp(value.mobile, value.otp, value.purpose);
  if (result.token) {
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(
        { user: result.user, token: result.token, refreshToken: result.refreshToken },
        'Login successful'
      )
    );
  }
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success({ user: null, token: null, refreshToken: null }, 'OTP verified. Proceed to register.')
  );
});

/**
 * POST /api/auth/login
 * Body: { identifier, password }
 * For Admin / Manager / Staff only.
 */
export const login = asyncHandler(async (req, res) => {
  const value = req.validated;
  const result = await authService.loginWithPassword(value.identifier, value.password);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(
      { user: result.user, token: result.token, refreshToken: result.refreshToken },
      'Login successful'
    )
  );
});

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 * Refreshes access token using refresh token
 */
export const refresh = asyncHandler(async (req, res) => {
  const value = req.validated;
  const result = await authService.refreshToken(value.refreshToken);
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(
      {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
      'Token refreshed successfully'
    )
  );
});

/**
 * POST /api/auth/register
 * Body: 
 *   - accountType: 'individual' | 'organization'
 *   - For individual: { mobile, fullName, email?, referralCode?, vehicle }
 *   - For organization: 
 *     - ownerType: 'registered' | 'non-registered'
 *     - If registered: { ownerIdentifier (ID/phone), mobile, fullName, email?, vehicle }
 *     - If non-registered: { owner: { fullName, mobile, email?, address? }, mobile, fullName, email?, vehicle }
 * Files (optional): profilePhoto, driverPhoto, ownerPhoto, rcPhoto
 * Creates user + vehicle; returns userId, vehicleId, loyaltyId (frontend generates QR from loyaltyId)
 */
export const register = asyncHandler(async (req, res) => {
  const value = req.validated;
  const s3Uploads = req.s3Uploads || {};
  
  // Extract photo URLs from S3 uploads
  const registrationData = {
    accountType: value.accountType,
    mobile: value.mobile,
    fullName: value.fullName,
    email: value.email,
    referralCode: value.referralCode,
    address: value.address || null,
    vehicle: value.vehicle,
    profilePhoto: s3Uploads.profilePhoto || null,
    driverPhoto: s3Uploads.driverPhoto || null,
    ownerPhoto: s3Uploads.ownerPhoto || null,
    rcPhoto: s3Uploads.rcPhoto || null,
    // Organization fields
    ownerType: value.ownerType,
    ownerIdentifier: value.ownerIdentifier,
    owner: value.owner,
  };
  
  const result = await userService.register(registrationData);
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      {
        userId: result.userId,
        vehicleId: result.vehicleId,
        loyaltyId: result.loyaltyId,
        user: result.user,
        vehicle: result.vehicle,
        ownerId: result.ownerId || null,
      },
      'Registration successful. Frontend can generate QR from loyaltyId.'
    )
  );
});
