
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Admin from "../models/admin/Admin.js";


export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    // 1️⃣ Extract token from cookies or headers
    const authHeader = req.header("Authorization");
    const cookieToken = req.cookies?.accessToken;
    const token = cookieToken || (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null);

    if (!token) {
      throw new ApiError(401, "Unauthorized — No token provided");
    }

    // 2️⃣ Verify and decode token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      console.error("❌ JWT Verification failed:", err.message);
      throw new ApiError(401, "Invalid or expired access token");
    }

    // 3️⃣ Extract user info
    const { _id, userType, role } = decoded;
    const roleType = (userType || role || "").toLowerCase();

    if (!_id || !roleType) {
      throw new ApiError(403, "Invalid token payload — missing role or ID");
    }

    // 4️⃣ Identify user based on role
    let user = null;
    switch (roleType) {
      case "admin":
        user = await Admin.findById(_id).select("-refreshToken");
        break;
      case "owner":
        user = await Owner.findById(_id).select("-refreshToken");
        break;
      case "manager":
        user = await Manager.findById(_id).select("-refreshToken");
        break;
      case "tenant":
        user = await Tenant.findById(_id).select("-refreshToken");
        break;
      default:
        throw new ApiError(403, "Invalid user type in token");
    }

    if (!user) {
      throw new ApiError(401, "User not found or unauthorized");
    }

    // 5️⃣ Attach authenticated user data to request
    req.user = user;
    req.userType = roleType;

    // 6️⃣ Proceed to next middleware or controller
    next();
  } catch (error) {
    console.error("❌ Error in verifyJWT middleware:", error.message);
    // Send clean JSON error instead of crashing
    const statusCode = error.statusCode || 401;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Authentication failed",
      statusCode,
    });
  }
});
