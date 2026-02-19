/**
 * Common status enums (Fuel Loyalty System)
 */
export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
});

export const VEHICLE_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
});

export const TRANSACTION_STATUS = Object.freeze({
  COMPLETED: 'completed',
  PENDING: 'pending',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

export const PUMP_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
});

export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

export const REDEMPTION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  USED: 'used',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
});
