# ADMIN_WEB_TODO.md

## Purpose
Create/complete the remaining Admin Web pages in `frontend/src/pages` and ensure they are wired to the backend APIs under `/api/admin` (plus a few non-admin endpoints used by the UI).

This doc is written so an AI agent can implement the remaining screens with minimal guesswork.

## Current Frontend Admin Screens (from `frontend/src/router/routes.tsx`)
Implemented (mostly):
`/` -> `AdminDashboard`
`/users` -> `AdminUsers`
`/users/new` -> `AdminUserCreate`
`/users/:userId` -> `AdminUserDetail`
`/managers` -> `AdminManagers`
`/managers/create` -> `AdminCreateManager`
`/managers/:managerId` -> `AdminManagerDetail`
`/staff` -> `AdminStaffList`
`/staff/:staffId` -> `AdminStaffDetail`
`/pumps` -> `AdminPumps`
`/background` -> `AdminBackground`
`/config` -> `AdminConfig`
`/banners` -> `AdminBanners`
`/redemptions` -> `AdminRedemptions`

Placeholders (need implementation):
`/campaigns` -> `AdminCampaigns` (currently placeholder)
`/rewards` -> `AdminRewards` (currently placeholder)
`/staff-assignments` -> `AdminStaffAssignments` (currently placeholder)
`/stats` -> `AdminStats` (currently placeholder)

Missing but referenced by Sidebar:
`/wallet` -> referenced in `frontend/src/components/Layouts/Sidebar.tsx` but NOT present in `frontend/src/router/routes.tsx`.
You must add it and implement the page.

## Frontend Integration Rules (How API calls should be done)
1. All authenticated API calls use the shared axios instance: `frontend/src/utils/axios.ts`
   - It attaches `Authorization: Bearer <accessToken>` from `localStorage.accessToken`
   - It auto-refreshes on `401` (but see “Auth Endpoint Mismatch” below).
2. Admin API wrappers live in: `frontend/src/api/adminApi.ts`
   - Prefer adding missing wrappers there, instead of hardcoding URLs in pages.
3. Navigation:
   - Routes are configured in `frontend/src/router/routes.tsx`
   - Admin routes are protected by `frontend/src/components/ProtectedRoute.tsx`

## Auth Endpoint Mismatch (Pre-check)
There is likely an endpoint mismatch between frontend and backend for admin refresh/logout:
- Frontend calls:
  - `frontend/src/api/auth.ts` -> `POST /api/admin/logout`
  - `frontend/src/api/auth.ts` -> `POST /api/admin/refresh-token`
  - `frontend/src/utils/axios.ts` refresh -> `refreshApi.post('admin/refresh-token', ...)` (this appears to be missing `/api/`)
- Backend exposes:
  - `backend/src/routes/auth.routes.js` -> `POST /api/auth/logout`
  - `backend/src/routes/auth.routes.js` -> `POST /api/auth/refresh`

Before/while implementing pages, verify login stays functional and refresh/logout works.
If the admin panel already works locally for you, keep existing behavior.
If not, align the endpoints (do this once globally, not per-page).

## Backend APIs (Authoritative reference)
Admin routes are in: `backend/src/routes/admin.routes.js`
- All admin endpoints are under `/api/admin/...`
- RBAC: routes require `admin` role for admin-only endpoints; some accept `admin` and `manager` too.

Non-admin endpoints used by Admin UI wrappers:
- `GET /api/user/:userId/wallet`
- `GET /api/transactions` (admin wrapper uses it for listing user transactions)
- `GET /api/user/scan/lookup`
- `GET /api/owner/search`
- `GET /api/user/vehicles`

## Existing Frontend API Wrapper Coverage (what exists already)
File: `frontend/src/api/adminApi.ts`

Already available (used by implemented pages and should be reused):
- Dashboard
  - `fetchDashboard()` -> `GET /api/admin/dashboard`
  - `fetchReviewStats(...)` -> `GET /api/admin/stats/review`
  - `fetchUserRegistrations(...)` -> `GET /api/admin/stats/user-registrations`
- Users
  - `fetchUsers(params)` -> `GET /api/admin/users`
  - `fetchUserById(userId)` -> `GET /api/admin/users/:userId`
  - `createUser(formData)` -> `POST /api/admin/users` (multipart)
  - `updateUser(userId, body, type?)` -> `PATCH /api/admin/users/:userId?type=...`
  - `updateUserStatus(userId, status, reason?)` -> `PATCH /api/admin/users/:userId/status`
  - `deleteUser(userId, type?)` -> `DELETE /api/admin/users/:userId?type=...`
- Managers
  - `fetchManagers(params)` -> `GET /api/admin/managers`
  - `fetchManagerById(managerId)` -> `GET /api/admin/managers/:managerId`
  - `createManager(formData)` -> `POST /api/admin/users` (multipart)
- Staff
  - `fetchStaff(params)` -> `GET /api/admin/staff`
  - `fetchStaffById(staffId)` -> `GET /api/admin/staff/:staffId`
- Pumps
  - `fetchPumps(params)` -> `GET /api/admin/pumps`
  - `fetchPumpById(pumpId)` -> `GET /api/admin/pumps/:pumpId`
- Redemptions
  - `fetchRedemptions(params)` -> `GET /api/redeem`
  - `approveRedemption(id, reason?)` -> `POST /api/admin/redemptions/:id/approve`
  - `rejectRedemption(id, reason)` -> `POST /api/admin/redemptions/:id/reject`
  - `directRedeem({ userId, pointsToDeduct, pumpId })` -> `POST /api/admin/redemptions/direct`
- Config
  - `fetchConfig()` -> `GET /api/admin/config`
  - `updateConfig(body)` -> `PATCH /api/admin/config`
- Campaigns
  - Only list exists: `fetchCampaigns(params)` -> `GET /api/admin/campaigns` (CRUD wrappers missing)
- Banners (CRUD exists)
  - `fetchBanners`, `fetchBannerById`, `createBanner`, `updateBanner`, `deleteBanner`
- Rewards
  - Only list exists: `fetchRewards(params)` -> `GET /api/admin/rewards` (CRUD wrappers missing)
- Staff Assignments
  - List exists: `fetchStaffAssignments(params)` -> `GET /api/admin/staff-assignments`
  - Assign & remove exist:
    - `assignStaffToPump({ staffId, pumpId })` -> `POST /api/admin/staff-assignments`
    - `removeStaffAssignment(assignmentId)` -> `DELETE /api/admin/staff-assignments/:assignmentId`
  - Lookup lists exist:
    - `fetchAssignmentsByStaff(staffId)` -> `GET /api/admin/staff-assignments/staff/:staffId`
    - `fetchStaffByPump(pumpId)` -> `GET /api/admin/staff-assignments/pump/:pumpId`
    - `fetchEmployeeList({ type, pumpId?, search?, page?, limit? })` -> `GET /api/admin/employee-list`
- Wallet
  - `fetchUserWallet(userId)` -> `GET /api/user/:userId/wallet`
  - `adjustWallet({ userId, points, type, reason? })` -> `POST /api/admin/wallet/adjust`
- Pump background CRUD exists:
  - `fetchPumpBackgrounds`, `fetchPumpBackgroundById`, `createPumpBackground`, `updatePumpBackground`, `deletePumpBackground`

## What the AI Agent Must Implement

### A) Implement missing `/wallet` screen
Goal: create `frontend/src/pages/AdminWallet.tsx` and add route `/wallet`.

Backend endpoint:
- `POST /api/admin/wallet/adjust` (validated by `backend/src/validation/wallet.validation.js`)
  - Body:
    - `userId` (24 hex string)
    - `points` (> 0, number)
    - `type` in: `credit | debit | adjustment | refund | expiry`
    - `reason` optional string

Also display wallet summary:
- `GET /api/user/:userId/wallet` (used by admin user detail already)

Implementation steps:
1. Update `frontend/src/router/routes.tsx`:
   - Add `{ path: '/wallet', element: <AdminWallet />, layout: 'default' }`
2. Create `frontend/src/pages/AdminWallet.tsx`:
   - Page layout:
     - Customer lookup section (by search input).
       - Reuse `fetchUsers({ page, limit, search })` with pagination if you want search-by-name/mobile/email.
       - OR reuse a simpler flow: input a `userId` and call `fetchUserWallet(userId)`.
     - Wallet summary section:
       - Use `fetchUserWallet(selectedUserId)` and show:
         - `available`, `totalEarned`, `totalRedeemed`
       - Handle missing fields (some endpoints may return nested data).
     - Wallet adjustment form:
       - Inputs: `userId` (hidden or selected), `points`, `type` dropdown, `reason` optional
       - Submit: call `adjustWallet({ userId, points, type, reason? })`
     - After success:
       - Refresh wallet summary (re-call `fetchUserWallet`).

UX requirements:
- Loading + error states.
- Disable submit while saving.
- Validate `points > 0`.

### B) Implement `AdminCampaigns.tsx` (CRUD)
Current state: placeholder page.

Backend endpoints (all under `/api/admin/campaigns`):
- `POST /api/admin/campaigns` -> create
- `GET /api/admin/campaigns` -> list (pagination likely supported)
- `GET /api/admin/campaigns/:campaignId` -> get by id
- `PATCH /api/admin/campaigns/:campaignId` -> update
- `DELETE /api/admin/campaigns/:campaignId` -> delete

Backend validation (`backend/src/validation/campaign.validation.js`):
- Create required:
  - `name` (2..100 chars)
  - `type` in: `multiplier | bonusPoints | bonusPercentage`
  - type-specific:
    - multiplier: `multiplier` required > 0
    - bonusPoints: `bonusPoints` required > 0
    - bonusPercentage: `bonusPercentage` required > 0 and <= 100
  - `startDate`, `endDate`
- Optional:
  - `conditions` (minAmount/minliters/categories/userSegment/frequencyLimit)
  - `pumpIds` (array of 24-hex strings)
  - `status`

Frontend work:
1. Add missing API wrappers in `frontend/src/api/adminApi.ts`:
   - `createCampaign(body)`
   - `fetchCampaignById(campaignId)`
   - `updateCampaign(campaignId, body)`
   - `deleteCampaign(campaignId)`
2. Implement `frontend/src/pages/AdminCampaigns.tsx`:
   - List view with pagination and search (if backend supports it; otherwise just pagination).
   - Create/Edit modal form:
     - Fields based on validation above.
     - `type` dropdown controls conditional input:
       - show `multiplier` OR `bonusPoints` OR `bonusPercentage`
   - Delete confirmation dialog.
   - After each mutation, reload list.

### C) Implement `AdminRewards.tsx` (CRUD)
Current state: placeholder page.

Backend endpoints under `/api/admin/rewards`:
- `POST /api/admin/rewards`
- `GET /api/admin/rewards`
- `GET /api/admin/rewards/:rewardId`
- `PATCH /api/admin/rewards/:rewardId`
- `DELETE /api/admin/rewards/:rewardId`

Backend validation (`backend/src/validation/reward.validation.js`):
- Required:
  - `name`
  - `type` in: `discount | freeItem | cashback | voucher`
  - `pointsRequired` (int >= 1)
  - `value` (>= 0)
  - `discountType` (valid values: `percentage | fixed | free`) default `fixed`
  - `availability` (`unlimited | limited`) default `unlimited`
  - `validFrom`, `validUntil`
- If `availability=limited`:
  - `totalQuantity` required (int >= 1)
- Optional:
  - `applicablePumps` (array of 24-hex strings)
  - `status` (`active | inactive | expired`) default `active`
  - `description`
  - `imageUrl` (uri string; note: rewardValidation expects string URI, not file upload)

Frontend work:
1. Add missing API wrappers in `frontend/src/api/adminApi.ts`:
   - `createReward(body)`
   - `fetchRewardById(rewardId)`
   - `updateReward(rewardId, body)`
   - `deleteReward(rewardId)`
2. Implement `frontend/src/pages/AdminRewards.tsx`:
   - List + pagination
   - Create/Edit modal:
     - `type` dropdown
     - `discountType` dropdown (or keep only for discounts if your UI decides)
     - `availability` dropdown:
       - show `totalQuantity` field only when `limited`
     - `applicablePumps`:
       - optional; for MVP you can skip pump selection and allow empty array.
       - if implementing: add a multi-select populated by `fetchPumps({ limit: 200 })`
     - `imageUrl` input as string URL (do NOT implement file upload unless you confirm backend expects multipart for rewards).
   - Delete confirmation + reload.

### D) Implement `AdminStaffAssignments.tsx`
Current state: placeholder page.

Backend endpoints under `/api/admin`:
- `GET /api/admin/staff-assignments` (list assignments)
- `POST /api/admin/staff-assignments` -> assign staff to pump (`staffId`, `pumpId`)
- `DELETE /api/admin/staff-assignments/:assignmentId`
- Unassigned lists:
  - `GET /api/admin/employee-list?type=staff|manager&pumpId?&search?&page?&limit?`
- Lookups:
  - `GET /api/admin/staff-assignments/staff/:staffId`
  - `GET /api/admin/staff-assignments/pump/:pumpId`

Backend validation (`backend/src/validation/staffAssignment.validation.js`):
- Assign body: `{ staffId, pumpId }` (both 24-hex strings)

Frontend work (use existing wrappers already in adminApi.ts):
- `fetchEmployeeList`
- `fetchAssignmentsByStaff`
- `fetchStaffByPump`
- `assignStaffToPump`
- `removeStaffAssignment`

Recommended UI flow:
1. Tab A: “Assign by Staff”
   - Step 1: Search/select a staff from `fetchEmployeeList({ type: 'staff', ... })`
   - Step 2: Select a pump (use `fetchPumps({ limit: 200 })` already available in adminApi.ts)
     - If RBAC is manager-scoped, backend will restrict pumps by manager; but the UI can still filter by displaying all pumps and rely on backend.
   - Step 3: Assign -> call `assignStaffToPump({ staffId, pumpId })`
   - Step 4: Show current assignments for that staff -> `fetchAssignmentsByStaff(staffId)`
2. Tab B: “Assign by Pump”
   - Step 1: Select a pump
   - Step 2: Show staff currently assigned to that pump -> `fetchStaffByPump(pumpId)`
   - Step 3: Add from unassigned employee list filtered by `type='staff'` (optionally pass `pumpId` if backend uses it)
3. In both tabs:
   - Each assignment row has a delete action -> `removeStaffAssignment(assignmentId)`

UX requirements:
- Loading & empty states
- Avoid duplicate assignment calls (disable assign while saving)

### E) Implement `AdminStats.tsx`
Current state: placeholder.

Backend endpoints:
- `GET /api/admin/stats/review` -> `fetchReviewStats(params)`
  - Query filters (see `backend/src/validation/stats.validation.js`):
    - pumpId?, userId?, fuelType?
    - startDate?, endDate?
    - month?, year?
    - startTime?, endTime?
- `GET /api/admin/stats/user-registrations` -> `fetchUserRegistrations(params)`
  - Query filters:
    - startDate?, endDate?, month?, year?
    - groupBy? (`day | month`)

Frontend work:
1. Implement filter UI:
   - At minimum: `startDate`, `endDate`, `startTime`, `endTime`
   - Optional: `pumpId` dropdown using `fetchPumps({ limit: 200 })`
   - Optional: `fuelType` dropdown
   - Optional: `userId` free input (call may be slow; debouncing recommended)
2. Render charts:
   - If you already have chart components in the project, reuse them (for example dashboard uses:
     - `AreaChart`, `RadarChart`, `DonutChart`)
   - Suggested for stats page:
     - Area/line chart for review totals by day/week (you will need to aggregate `reviewStats.list`)
     - A second chart for registrations using `fetchUserRegistrations`
3. Loading/error states and re-fetch on filter changes.

## How to Keep the Implementation Consistent
- Follow the style/state patterns already used:
  - `useEffect` + `loading/error/data/meta` pattern
  - tables with pagination meta (use `PaginatedMeta` where available)
  - `toast` for user feedback (`react-toastify`)
- Put all new API functions into `frontend/src/api/adminApi.ts`.

## Suggested Agent Checklist (quick)
1. Add `/wallet` route + implement `AdminWallet.tsx`
2. Add campaign + reward CRUD API wrappers in `adminApi.ts`
3. Implement `AdminCampaigns.tsx` CRUD UI
4. Implement `AdminRewards.tsx` CRUD UI
5. Implement `AdminStaffAssignments.tsx` UI flows using existing wrappers
6. Implement `AdminStats.tsx` filters + charts using existing review/stats endpoints

