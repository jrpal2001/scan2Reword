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
        { user: result.user, token: result.token },
        'Login successful'
      )
    );
  }
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success({ user: null, token: null }, 'OTP verified. Proceed to register.')
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
      { user: result.user, token: result.token },
      'Login successful'
    )
  );
});

/**
 * POST /api/auth/register
 * Body: { mobile, fullName, email?, referralCode?, vehicle: { vehicleNumber, vehicleType, fuelType, ... } }
 * Creates user + vehicle; returns userId, vehicleId, loyaltyId (frontend generates QR from loyaltyId)
 */
export const register = asyncHandler(async (req, res) => {
  const value = req.validated;
  const result = await userService.register(
    { mobile: value.mobile, fullName: value.fullName, email: value.email },
    value.vehicle,
    value.referralCode
  );
  return res.status(HTTP_STATUS.CREATED).json(
    ApiResponse.success(
      {
        userId: result.userId,
        vehicleId: result.vehicleId,
        loyaltyId: result.loyaltyId,
        user: result.user,
        vehicle: result.vehicle,
      },
      'Registration successful. Frontend can generate QR from loyaltyId.'
    )
  );
});
