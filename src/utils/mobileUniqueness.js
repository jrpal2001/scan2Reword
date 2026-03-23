import Admin from '../models/Admin.js';
import { ROLES } from '../constants/roles.js';
import { managerRepository } from '../repositories/manager.repository.js';
import { staffRepository } from '../repositories/staff.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import ApiError from './ApiError.js';
import { HTTP_STATUS } from '../constants/errorCodes.js';

/**
 * Resolve whether a mobile is already used by any account type (Admin/Manager/Staff/User).
 * Returns null when free, else { role, id, label }.
 */
export async function findAccountByMobileAcrossRoles(mobile) {
  if (!mobile || typeof mobile !== 'string') return null;
  const trimmed = mobile.trim();
  if (!trimmed) return null;

  const [admin, manager, staff, user] = await Promise.all([
    Admin.findOne({ phone: trimmed }).select('_id').lean(),
    managerRepository.findByMobile(trimmed),
    staffRepository.findByMobile(trimmed),
    userRepository.findByMobile(trimmed),
  ]);

  if (admin) return { role: ROLES.ADMIN, id: String(admin._id), label: 'Admin' };
  if (manager) return { role: ROLES.MANAGER, id: String(manager._id), label: 'Manager' };
  if (staff) return { role: ROLES.STAFF, id: String(staff._id), label: 'Staff' };
  if (user) return { role: ROLES.USER, id: String(user._id), label: 'User' };
  return null;
}

/**
 * Enforce cross-role mobile uniqueness across Admin/Manager/Staff/User.
 * excludeRole/excludeId allows keeping same mobile on the same record during updates.
 */
export async function assertMobileIsGloballyUnique(
  mobile,
  { excludeRole = null, excludeId = null, fieldLabel = 'Mobile number' } = {}
) {
  const existing = await findAccountByMobileAcrossRoles(mobile);
  if (!existing) return;

  if (
    excludeRole
    && excludeId
    && String(existing.role) === String(excludeRole).toLowerCase()
    && existing.id === String(excludeId)
  ) {
    return;
  }

  throw new ApiError(HTTP_STATUS.CONFLICT, `${fieldLabel} already registered for ${existing.label}`);
}
