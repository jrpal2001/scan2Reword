# Separate Models: Manager, Staff, User (Customer)

This document describes the split from a single **UserLoyalty** model (with `role`) to **4 separate entities**:
- **Admin** – already separate (`Admin` model)
- **Manager** – `Manager.model.js`
- **Staff** – `Staff.model.js`
- **User (customer)** – `User.model.js` (refactored; collection still **UserLoyalty** for backward compatibility)

---

## What Was Implemented

### 1. Models
- **`src/models/Manager.model.js`** – fullName, mobile, email, passwordHash, managerCode, referralCode, **walletSummary**, address, profilePhoto, FcmTokens, status, createdBy, createdByModel.
- **`src/models/Staff.model.js`** – fullName, mobile, email, passwordHash, staffCode, referralCode, **walletSummary**, assignedManagerId (ref Manager), address, profilePhoto, FcmTokens, status, createdBy, createdByModel.
- **`src/models/User.model.js`** – **Customer only**: fullName, mobile, email, passwordHash (optional), walletSummary, referralCode, ownerId, FcmTokens, address, profilePhoto, driverPhoto, ownerPhoto, status, createdBy, createdByModel. No `role`, `managerCode`, or `staffCode`.
- **`src/models/PointsLedger.model.js`** – added **ownerType** (`'UserLoyalty' | 'Manager' | 'Staff'`, default `'UserLoyalty'`) so points can be credited to Manager/Staff.
- **`src/models/RefreshToken.model.js`** – **userType** (`'UserLoyalty' | 'Manager' | 'Staff' | 'Admin'`, default `'UserLoyalty'`).
- **`src/models/StaffAssignment.model.js`** – **staffId** (ref Staff).
- **`src/models/Pump.model.js`** – **managerId** refs **Manager**.

### 2. Auth (completed)
- **auth.service.js** – login tries Manager → Staff → Admin → User; JWT/refresh include **userType**; **storeRefreshToken** and **logout** accept **userType** and update FcmTokens on the correct model (User/Manager/Staff).
- **auth.middleware.js (verifyJWT)** – resolves **req.user** and **req.userType** from **decoded.userType** (Admin, Manager, Staff, UserLoyalty).
- **auth.controller.js** – logout passes **req.userType** to authService.logout.

### 3. User service (completed)
- **createUserByAdmin** – role **manager** → **managerRepository.create**; role **staff** → **staffRepository.create** (and **staffAssignmentService.assignStaffToPump(staffId, …)**); role **user** → **userRepository.create** (customers only).
- **createUserByManagerOrStaff** – staff → **staffRepository.create**; user → **userRepository.create**. Registration points credited via **pointsService.creditPoints** with **ownerType** (Manager/Staff).
- **register** – referral code resolved via **findReferrerByCode** (Manager, Staff, User); referral points credited with **ownerType** (Manager/Staff).
- **generateUniqueManagerCode** / **generateUniqueStaffCode** – use **managerRepository** / **staffRepository**.
- **generateReferralCode(userId, userType)** – supports Manager/Staff; updates the correct repo.

### 4. Points (completed)
- **points.service.js** – **creditPoints**, **debitPoints**, **getWallet** accept **ownerType** (`'UserLoyalty' | 'Manager' | 'Staff'`). Load/update **userRepository**, **managerRepository**, or **staffRepository** and create **PointsLedger** entries with **userId** + **ownerType**.
- **pointsLedger.repository.js** – **findByUserId** accepts **options.ownerType**; **findExpiringPoints** accepts **ownerType** (default `'UserLoyalty'`).

### 5. Staff assignment (completed)
- **staffAssignment.service.js** – uses **staffRepository**; **assignStaffToPump** creates assignment with **staffId** (Staff model _id).
- **staffAssignment.repository.js** – all filters and populates use **staffId** (not userId).
- **pump.repository.js** – **findPumpIdsByStaffId** queries **StaffAssignment** by **staffId**.

### 6. Controllers
- **admin.controller.js** – createUser / createUserByOperator return **result.user** with **role** set (Manager/Staff/User). **listUsers** lists customers only (no role filter; User model has no role).
- **user.controller.js** – **getReferralCode** uses **req.userType** and **userService.generateReferralCode(userId, userType)** for Manager/Staff.

### 7. RBAC
- **attachPumpScope** – uses **req.user._id** with **findPumpIdsByManagerId** (Manager) or **findPumpIdsByStaffId** (Staff); **req.user** is loaded from Manager/Staff/User by **verifyJWT**.

---

## Reward points (where stored)

- **User (customer)** – **walletSummary** on **User** model; **PointsLedger** with **userId** + **ownerType: 'UserLoyalty'**.
- **Manager / Staff** – **walletSummary** on **Manager** / **Staff** model; **PointsLedger** with **userId** (owner _id) + **ownerType: 'Manager'** or **'Staff'**.
- **Referral** (user registers with referral code) – points credited to referrer (Manager or Staff) via **pointsService.creditPoints({ userId: referrer._id, ownerType: referrer._ownerType, … })**.
- **Registration** (manager/staff creates user) – points credited to operator via **pointsService.creditPoints({ userId: operatorId, ownerType: 'Manager' | 'Staff', … })**.

---

## Optional / future

- **List managers and staff** – **listUsers** currently returns only customers. Add **GET /api/admin/managers** and **GET /api/admin/staff** (using **managerRepository.list** / **staffRepository.list**) if needed.
- **Dashboard** – aggregate “users by type” from Manager, Staff, and User collections if needed.
- **Admin update manager/staff** – **updateUser** / **updateUserStatus** are customer-only; add separate update endpoints for Manager/Staff if needed.

---

## Data migration (existing DB)

If you have existing **UserLoyalty** documents with `role: 'manager'` or `role: 'staff'`:

1. Export documents where `role` is manager or staff.
2. Insert into **Manager** or **Staff** collections (map fields: managerCode, staffCode, assignedManagerId, walletSummary, etc.).
3. Update **Pump.managerId** to new Manager _ids; **StaffAssignment** – create new documents with **staffId** pointing to new Staff _ids (or run a script to map old userId → new Staff _id).
4. Optionally remove or leave old manager/staff documents in UserLoyalty (ensure no references point to them).

You can add a one-time migration script (e.g. in `src/seed`) to do this.
