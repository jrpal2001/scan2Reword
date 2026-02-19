/**
 * User roles for RBAC (Fuel Loyalty System)
 * Use lowercase in code and DB.
 */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  USER: 'user',
});

export const ROLE_LIST = Object.values(ROLES);

/** Roles that login with identifier + password (not OTP) */
export const STAFF_ROLES = [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF];

/** Role that logs in with OTP only */
export const CUSTOMER_ROLE = ROLES.USER;
