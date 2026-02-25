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
 * Body: { mobile, otp, purpose?, fcmToken?, deviceInfo? }
 * Returns JWT + user if mobile already registered (login); else { user: null, token: null } for registration flow.
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const value = req.validated;
  const result = await authService.verifyOtp(
    value.mobile,
    value.otp,
    value.purpose,
    value.fcmToken || null,
    value.deviceInfo || null,
    req.ip,
    req.get('user-agent')
  );
  if (result.token) {
    const payload = {
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken,
      requiresPasswordSet: result.requiresPasswordSet ?? false,
      isManager: result.isManager ?? false,
      isStaff: result.isStaff ?? false,
      isIndividualUser: result.isIndividualUser ?? false,
      isFleetOwner: result.isFleetOwner ?? false,
      isFleetDriver: result.isFleetDriver ?? false,
    };
    return res.status(HTTP_STATUS.OK).json(
      ApiResponse.success(payload, result.requiresPasswordSet ? 'Login successful. Please set your password.' : 'Login successful')
    );
  }
  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(
      {
        user: null,
        token: null,
        refreshToken: null,
        requiresPasswordSet: false,
        isManager: false,
        isStaff: false,
        isIndividualUser: false,
        isFleetOwner: false,
        isFleetDriver: false,
      },
      'OTP verified. Proceed to register.'
    )
  );
});

/**
 * POST /api/auth/login
 * Body: { identifier } — no password. Returns who the user is so frontend can decide next step.
 * - If isAdmin: true → frontend calls POST /api/auth/verify-password every time.
 * - If isAdmin: false → returns isManager, isStaff, isIndividualUser, isFleetOwner, isFleetDriver, requiresPasswordSet.
 *   - If requiresPasswordSet: true → frontend calls send-otp, then verify-otp, then setPassword if manager/staff.
 *   - If requiresPasswordSet: false and (isManager or isStaff) → frontend calls verify-password.
 */
export const login = asyncHandler(async (req, res) => {
  const value = req.validated;
  const result = await authService.checkLogin(value.identifier);
  return res.status(HTTP_STATUS.OK).json(ApiResponse.success(result, 'Login check successful'));
});

/**
 * POST /api/auth/verify-password
 * Body: { identifier, password, fcmToken?, deviceInfo? }
 * For Admin (every time after login), Manager, Staff (when requiresPasswordSet was false). Returns token + user.
 */
export const verifyPassword = asyncHandler(async (req, res) => {
  const value = req.validated;
  const result = await authService.loginWithPassword(
    value.identifier,
    value.password,
    value.fcmToken || null,
    value.deviceInfo || null,
    req.ip,
    req.get('user-agent')
  );
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
 *   - For individual: { mobile, fullName, email?, referralCode?, vehicle, fcmToken?, deviceInfo? }
 *   - For organization: 
 *     - ownerType: 'registered' | 'non-registered'
 *     - If registered: { ownerIdentifier (ID/phone), mobile, fullName, email?, vehicle, fcmToken?, deviceInfo? }
 *     - If non-registered: { owner: { fullName, mobile, email?, address? }, mobile, fullName, email?, vehicle, fcmToken?, deviceInfo? }
 * Files (optional): profilePhoto, driverPhoto, ownerPhoto, rcPhoto
 * Creates user + vehicle; returns userId, vehicleId, loyaltyId (frontend generates QR from loyaltyId)
 */
export const register = asyncHandler(async (req, res) => {
  const value = req.validated;
  const s3Uploads = req.s3Uploads || {};
  
  // Extract photo URLs from S3 uploads
  const registrationData = {
    accountType: value.accountType,
    ownerOnly: !!value.ownerOnly,
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
    insurancePhoto: s3Uploads.insurancePhoto || null,
    fitnessPhoto: s3Uploads.fitnessPhoto || null,
    pollutionPhoto: s3Uploads.pollutionPhoto || null,
    vehiclePhoto: Array.isArray(s3Uploads.vehiclePhoto) ? s3Uploads.vehiclePhoto : (s3Uploads.vehiclePhoto ? [s3Uploads.vehiclePhoto] : null),
    // Organization fields
    ownerType: value.ownerType,
    ownerIdentifier: value.ownerIdentifier,
    owner: value.owner,
    // FCM token and device info for multi-device support
    fcmToken: value.fcmToken || null,
    deviceInfo: value.deviceInfo || null,
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

/**
 * POST /api/auth/set-password
 * Body: { password }
 * Requires: Authorization (Manager or Staff only). Use after first-time OTP login when requiresPasswordSet is true.
 */
export const setPassword = asyncHandler(async (req, res) => {
  const value = req.validated;
  const userType = req.userType || req.user?.role;
  if (userType !== 'manager' && userType !== 'staff') {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only Manager or Staff can set password');
  }
  const result = await authService.setPassword(req.user._id, userType === 'manager' ? 'Manager' : 'Staff', value.password);
  return res.status(HTTP_STATUS.OK).json(ApiResponse.success(result, result.message));
});

/**
 * POST /api/auth/logout
 * Body: { fcmToken?, refreshToken? }
 * Requires: Authorization header with access token
 * 
 * Logout behavior:
 * - If fcmToken provided: Logs out from that specific device (revokes all tokens for that FCM token)
 * - If refreshToken provided (but no fcmToken): Revokes that specific refresh token
 * - If neither provided: Logs out from all devices (revokes all tokens for the user)
 * 
 * Recommended: Send fcmToken to logout from current device
 */
export const logout = asyncHandler(async (req, res) => {
  const value = req.validated || {};
  const userId = req.user?._id;
  
  if (!userId) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
  }

  const result = await authService.logout(
    userId,
    value.refreshToken || null,
    value.fcmToken || null,
    req.userType || null
  );

  return res.status(HTTP_STATUS.OK).json(
    ApiResponse.success(result, result.message)
  );
});
