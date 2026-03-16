# Admin Frontend – Connect & Flow Guide

This document describes **how to connect the Admin frontend to the backend**, the **auth flow**, and **all Admin APIs** with request/response shapes. Use it to design the UI and wire up the APIs.

---

## 1. Base URL & Authentication

### Base URL

- **Admin API base:** `{API_BASE}/api/admin`
- Example: `http://localhost:3000/api/admin` (replace with your backend URL).

### Admin Login (how admin gets a token)

Admin uses a **separate login** from customers (email + password, legacy Admin model).

| Item | Value |
|------|--------|
| **Endpoint** | `POST /api/admin/login` |
| **Auth** | None (public) |
| **Content-Type** | `application/json` |

**Request body:**

```json
{
  "email": "admin@example.com",
  "password": "your_password"
}
```

**Success response (200):**

```json
{
  "success": true,
  "message": "Admin logged in successfully",
  "data": {
    "user": {
      "_id": "...",
      "name": "Admin Name",
      "email": "admin@example.com",
      "phone": "...",
      "userType": "admin",
      "createdAt": "..."
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Note:** Backend may set **httpOnly cookies** (`accessToken`, `refreshToken`). If your frontend runs on a different origin, use the **accessToken** from the response and send it in the **Authorization** header for subsequent requests.

### Sending auth on every Admin request

After login, send the token on **every** Admin API call:

**Option A – Header (recommended for SPA / cross-origin):**

```http
Authorization: Bearer <accessToken>
```

**Option B – Cookies:**  
If same-site and backend sets cookies, the backend may read `accessToken` from cookies; confirm with your backend setup.

### Check current admin

| Item | Value |
|------|--------|
| **Endpoint** | `GET /api/admin/me` |
| **Auth** | Required (Admin JWT) |

**Success (200):** `{ "success": true, "user": {...}, "userType": "admin" }`  
Use this to validate the token and show the logged-in admin in the UI.

---

## 2. Recommended App Flow (Admin)

1. **Login screen**  
   - Call `POST /api/admin/login` with email + password.  
   - On success: store `data.accessToken` (and optionally `data.refreshToken`) in memory or secure storage.  
   - Store minimal user info from `data.user` for header/sidebar.

2. **Protected layout**  
   - Before rendering admin routes, call `GET /api/admin/me` with the stored token.  
   - If 401/403: clear token and redirect to login.  
   - If 200: user is admin; render dashboard/sidebar with `user` and `userType`.

3. **Dashboard (home)**  
   - Load `GET /api/admin/dashboard` and show KPIs (users, transactions, revenue, points, redemptions, recent transactions).

4. **Feature modules**  
- **Users:** list **customers** (search/status), create (form/multipart), view customer by id, edit, status (block/unblock), delete.  
  - **Managers:** list all (`GET /managers`), view by id (`GET /managers/:managerId`). Edit/delete via `/users/:userId?type=manager`.  
  - **Staff:** list all (`GET /staff`), view by id (`GET /staff/:staffId`). Edit/delete via `/users/:userId?type=staff`.  
  - **Unassigned employees:** `GET /employee-list?type=staff|manager` for assignment flows.  
  - **Pumps:** list (with filters), create (multipart), view, edit (multipart), delete.  
   - **Stats:** Review stats (filters + list + totals), User registration graph (filters + list + byPeriod + referral).  
   - **Campaigns / Banners / Rewards:** list, create, get one, update, delete (banners/campaigns: see form-data rules).  
   - **Config:** get config, patch (points, pointsExpiry).  
   - **Staff assignments:** assign staff to pump, list assignments, employee list (unassigned), by staff, by pump, remove.  
   - **Redemptions:** direct redeem (admin), approve/reject by id. List redemptions: `GET /api/redeem` (see below).  
   - **Wallet:** adjust (credit/debit user points).

5. **Logout**  
   - Clear stored token (and refreshToken). Optionally call a logout endpoint if you add one. Redirect to login.

---

## 3. Standard Response Shape

- **Success (single resource or action):**  
  `{ "success": true, "message": "...", "data": { ... } }`

- **Success (paginated list):**  
  `{ "success": true, "message": "...", "data": [ ... ], "meta": { "total", "page", "limit", "totalPages" } }`

- **Error:**  
  Typically `{ "success": false, "message": "..." }` or similar; status code 4xx/5xx. Handle 401 (unauthorized) and 403 (forbidden) for auth/role errors.

---

## 4. Admin APIs Reference

All below are under **`/api/admin`** and require **Admin JWT** unless noted.

---

### 4.1 Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Admin dashboard stats |

**Query:** None.

**Response `data`:** (high level)

- `users`: `{ total, newToday, newThisMonth, active }`
- `managers`: `{ total }`
- `staff`: `{ total }`
- `pumps`: `{ total }`
- `transactions`: `{ total, today, thisMonth }`
- `revenue`: `{ today, thisMonth, lastMonth, growth }`
- `points`: `{ totalEarned, totalRedeemed, totalExpired, available }`
- `redemptions`: `{ total, today, thisMonth }`
- `recentTransactions`: array of recent transaction summaries (pump, liters, operator, etc.)

**UI:** Use for dashboard KPIs, mini charts, and “recent transactions” table.

---

### 4.2 Stats (Review & User Registrations)

#### GET `/stats/review`

Transaction review stats: list of transactions (no attachments) + totals. Same filters as in [STATS_API_QUERY_GUIDE.md](./STATS_API_QUERY_GUIDE.md).

**Query (all optional):**  
`startDate`, `endDate`, `month`, `year`, `startTime`, `endTime`, `pumpId`, `userId`, `fuelType`  
- Dates: ISO or date strings; month 1–12; year 2000–2100.  
- `fuelType`: `Petrol`, `Diesel`, or `CNG` (filters Fuel transactions only).  
- Time: IST, `HH:mm` or `HH:mm:ss`.  
- If no date given: **current month (IST)**.

**Response `data`:**

- `list`: array of transaction objects (no `attachments`), with `createdAtIST` etc.
- `totalAmount`, `totalLiters`, `totalPointsGenerated`, `totalPointsRedeemed`
- `totalPointsGeneratedByStaffManager`, `totalPointsRedeemedByStaffManager`

**UI:** Filters (date range / month+year / time, pump, user), table from `list`, summary cards from totals.

#### GET `/stats/user-registrations`

User registration graph data: list of users + total + by period + referral stats.  
**Query (all optional):** `startDate`, `endDate`, `month`, `year`, `groupBy` (`day` \| `month`). Default period: current month IST; default `groupBy`: `day`.

**Response `data`:**

- `list`: user list (no profilePhoto, driverPhoto, ownerPhoto, walletSummary)
- `totalRegistrations`
- `byPeriod`: e.g. `[{ "period": "2025-03-01", "count": 5 }, ...]`
- `totalReferralPointsEarned`, `totalReferralSignups`

**UI:** Date/groupBy filters, chart from `byPeriod`, totals and referral metrics.

---

### 4.3 Users

| Method | Path | Description |
|--------|------|-------------|
| POST | `/users` | Create user (multipart/form-data) |
| GET | `/users` | List users (paginated) |
| GET | `/users/:userId` | Get user by ID |
| PATCH | `/users/:userId` | Update user |
| PATCH | `/users/:userId/status` | Update status (active/inactive/blocked) |
| DELETE | `/users/:userId` | Delete user |

**List users – GET `/users`**  
**Query:** `page`, `limit`, `status`, `search` (search in fullName, mobile, email).  
**Response:** Paginated: `data` = array of users, `meta` = `{ total, page, limit, totalPages }`.

**Get one – GET `/users/:userId`**  
**Response:** `data` = single user object (with `createdAtIST` etc.).

**Create – POST `/users`**  
- **Content-Type:** `multipart/form-data` (supports profile/driver/owner/vehicle photos).  
- Body: see validation (role, accountType, mobile, fullName, email, password, address, vehicle, owner, pumpId, etc.).  
- Files: use field names from backend (e.g. profilePhoto, driverPhoto, ownerPhoto, vehicle photos).  
- **Response:** `data` = created user (and assignment/owner info if applicable).

**Update – PATCH `/users/:userId`**  
- **Query (optional):** `type` = `manager` \| `staff` \| `user` (default `user`).  
- **Body (JSON):** fullName, email, role, address, staffCode, managerCode, assignedManagerId (partial).  
- **Response:** `data` = updated user/manager/staff.

**Status – PATCH `/users/:userId/status`**  
- **Body:** `{ "status": "active" | "inactive" | "blocked", "reason": "optional" }`.  
- **Response:** `data` = updated entity.

**Delete – DELETE `/users/:userId`**
- **Query (optional):** `type` = `manager` \| `staff` \| `user`.
- **Response:** `data` = `{ "deleted": true, "type": "..." }`.
- **Note:** When a user, manager, or staff is deleted, **transactions are not deleted**. They are kept for admin analytics and review tracking. Historical transaction data (e.g. in stats/review) remains available.

**UI:** User list with search/status filter and pagination; create user form (multipart); detail page; edit form; status dropdown; delete with type.

**Important:** `GET /users` and `GET /users/:userId` return **customers (User / UserLoyalty)** only. They do **not** return Manager or Staff records. Use the Managers and Staff APIs below for manager/staff list and details.

---

### 4.3a Managers (list + get by ID)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/managers` | List all managers (paginated) |
| GET | `/managers/:managerId` | Get manager by ID |

**List managers – GET `/managers`**  
**Query:** `page`, `limit`, `status`, `search` (searches fullName, mobile, email, managerCode).  
**Response:** Paginated: `data` = array of managers, `meta` = `{ total, page, limit, totalPages }`.  
**Note:** Response does **not** include `passwordHash` (passwords are never returned by any API).

**Get manager by ID – GET `/managers/:managerId`**  
**Response:** `data` = single manager object including **`passwordViewable`** (the actual password in plain text, decrypted) so admin can view it. Other fields: fullName, mobile, email, managerCode, referralCode, address, profilePhoto, status, walletSummary, etc., with `createdAtIST`.  
**Note:** `passwordViewable` is the decrypted password (backend uses `PASSWORD_VIEW_SECRET`). When manager/staff sets or resets password, a pre-save hook stores an encrypted copy; admin get-by-id returns it here. See §8 for backend env. To show a usable password to the manager, use an admin “set/reset password” flow that sets a new password and returns the new plain-text password once.

**UI:** Managers list page with search/status and pagination; manager detail page (view/edit via PATCH `/users/:userId?type=manager`).

---

### 4.3b Staff (list + get by ID)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/staff` | List all staff (paginated) |
| GET | `/staff/:staffId` | Get staff by ID |

**List staff – GET `/staff`**  
**Query:** `page`, `limit`, `status`, `search` (fullName, mobile, email, staffCode), `assignedManagerId` (filter by manager).  
**Response:** Paginated: `data` = array of staff, `meta` = `{ total, page, limit, totalPages }`.  
**Note:** Response does **not** include `passwordHash`.

**Get staff by ID – GET `/staff/:staffId`**  
**Response:** `data` = single staff object including **`passwordViewable`** (the actual password in plain text, decrypted) so admin can view it. Other fields: fullName, mobile, email, staffCode, assignedManagerId, referralCode, address, profilePhoto, status, walletSummary, etc., with `createdAtIST`.  
**Note:** `passwordViewable` is the decrypted password (backend uses `PASSWORD_VIEW_SECRET`). When manager/staff sets or resets password, a pre-save hook stores an encrypted copy; admin get-by-id returns it here. See §8 for backend env. To show a usable password to the staff, use an admin “set/reset password” flow that sets a new password and returns the new plain-text password once.

**UI:** Staff list page with search/status/manager filter and pagination; staff detail page (view/edit via PATCH `/users/:userId?type=staff`).

---

### 4.3c Unassigned employees (for assignment flow)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/employee-list` | List **unassigned** managers or staff (for assigning to pumps) |

**GET `/employee-list`**  
**Query:** `type` = `staff` \| `manager` (required), `pumpId` (optional, for type=manager), `search`, `page`, `limit`.  
**Response:** Paginated list of managers or staff who are **not** assigned to any pump. Use when building “Assign staff to pump” or “Assign manager to pump” UI.

---

### 4.4 Pumps

| Method | Path | Description |
|--------|------|-------------|
| POST | `/pumps` | Create pump (multipart) |
| GET | `/pumps` | List pumps (paginated) |
| GET | `/pumps/:pumpId` | Get pump by ID |
| PATCH | `/pumps/:pumpId` | Update pump (multipart) |
| DELETE | `/pumps/:pumpId` | Delete pump |

**List – GET `/pumps`**  
**Query:** `page`, `limit`, `status`, `managerId`.  
**Response:** Paginated; each item includes manager populates (managerId, name, profilePhoto, managerCode).

**Get one – GET `/pumps/:pumpId`**  
**Response:** `data` = pump object.

**Create – POST `/pumps`**  
- **Content-Type:** `multipart/form-data`.  
- Body: name, code (optional, auto-generated), managerId, location (address, city, state, pincode, lat, lng), status, pumpImages (files).  
- **Response:** `data` = created pump.

**Update – PATCH `/pumps/:pumpId`**  
- **Content-Type:** `multipart/form-data`.  
- Body: same fields as create (partial); pumpImages = new files and/or existing URLs (see backend banner/pump docs for replace/merge behavior).  
- **Response:** `data` = updated pump.

**Delete – DELETE `/pumps/:pumpId`**  
**Response:** `data` = null, message success.

**UI:** Pumps table with filters; create/edit pump form with map/address and image uploads.

---

### 4.5 Wallet

| Method | Path | Description |
|--------|------|-------------|
| POST | `/wallet/adjust` | Adjust user points (credit/debit/etc.) |

**Body (JSON):**

```json
{
  "userId": "<24-char hex ObjectId>",
  "points": 100,
  "type": "credit | debit | adjustment | refund | expiry",
  "reason": "optional text"
}
```

**Response:** `data` = created ledger entry.

**UI:** “Adjust wallet” form: select user (or pass userId), points, type, reason.

---

### 4.6 Campaigns

| Method | Path | Description |
|--------|------|-------------|
| POST | `/campaigns` | Create campaign |
| GET | `/campaigns` | List campaigns (paginated) |
| GET | `/campaigns/:campaignId` | Get campaign |
| PATCH | `/campaigns/:campaignId` | Update campaign |
| DELETE | `/campaigns/:campaignId` | Delete campaign |

**Create – POST `/campaigns`**  
**Body (JSON):**  
`name`, `type` (`multiplier` \| `bonusPoints` \| `bonusPercentage`), `multiplier` / `bonusPoints` / `bonusPercentage` (per type), `startDate`, `endDate`, `conditions` (minAmount, minliters, categories, etc.), `pumpIds` (array of IDs), `status`.

**List – GET `/campaigns`**  
**Query:** `page`, `limit`, filters as supported by backend.  
**Response:** Paginated list.

**Update – PATCH `/campaigns/:campaignId`**  
**Body (JSON):** Same fields as create (partial).  
**Delete – DELETE `/campaigns/:campaignId`**

**UI:** Campaign list, create/edit form with type-specific fields and date range.

---

### 4.7 Banners

| Method | Path | Description |
|--------|------|-------------|
| POST | `/banners` | Create banner (form-data + image) |
| GET | `/banners` | List banners (paginated) |
| GET | `/banners/:bannerId` | Get banner |
| PATCH | `/banners/:bannerId` | Update banner (form-data + optional image) |
| DELETE | `/banners/:bannerId` | Delete banner |

**Content-Type:** `multipart/form-data` for POST/PATCH.  
**Fields:** title, description, imageUrl (file or URL), linkUrl, startTime, endTime (ISO), pumpIds (JSON string array), status.  
See [BANNER_API_FORMDATA.md](./BANNER_API_FORMDATA.md) for full form-data and S3 behavior.

**List – GET `/banners`**  
**Query:** `page`, `limit`, `status`, `pumpId`.  
**Response:** Paginated list.

**UI:** Banner list; create/edit form with image upload and date range.

---

### 4.8 Rewards

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rewards` | Create reward |
| GET | `/rewards` | List rewards (paginated) |
| GET | `/rewards/:rewardId` | Get reward |
| PATCH | `/rewards/:rewardId` | Update reward |
| DELETE | `/rewards/:rewardId` | Delete reward |

**Create – POST `/rewards`**  
**Body (JSON):**  
`name`, `type` (`discount` \| `freeItem` \| `cashback` \| `voucher`), `pointsRequired`, `value`, `discountType`, `availability`, `totalQuantity` (if limited), `validFrom`, `validUntil`, `applicablePumps`, `status`, `description`, `imageUrl`.

**List – GET `/rewards`**  
**Query:** `page`, `limit`, etc.  
**Response:** Paginated list.

**UI:** Rewards list; create/edit form with type and validity dates.

---

### 4.9 System Config

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config` | Get system config |
| PATCH | `/config` | Update config (points, pointsExpiry) |

**Get – GET `/config`**  
**Response:** `data` = config object (points rules, pointsExpiry, etc.).

**Update – PATCH `/config`**  
**Body (JSON):**  
`points`: { registration, referral, referralForReferredUser, displayRupeesPerPoint, fuel, lubricant, store, service (number or object) },  
`pointsExpiry`: { durationMonths, notificationDays }.  
At least one top-level key required.

- **referral**: Points given to the referrer (Manager/Staff) when someone uses their referral code.
- **referralForReferredUser**: Points given to the new user (customer) when they sign up with a referral code.
- **displayRupeesPerPoint**: Display only — 1 point = this many rupees (e.g. `0.1` means 10 points = ₹1). Use in the UI to show “X points = ₹Y”; not used for redemption logic.

**UI:** Settings page with points (including referral and display conversion) and expiry forms.

---

### 4.10 Onboarding (admin only for CRUD; public GET list)

Onboarding stores **multiple images per document** in `onboardImage` (array). Admin uploads images via multipart; the app fetches the list publicly (no auth).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/onboarding` | Admin | Create one doc with multiple images (multipart: field `images`, max 10) |
| GET | `/api/admin/onboarding` | Admin | List all (paginated), sorted by `createdAt` |
| GET | `/api/admin/onboarding/:id` | Admin | Get one by ID |
| PATCH | `/api/admin/onboarding/:id` | Admin | Replace onboardImage array (multipart: field `images`, max 10) |
| DELETE | `/api/admin/onboarding/:id` | Admin | Delete item |
| GET | `/api/onboarding` | **Public** | List all onboarding docs (no auth). For app onboarding screens. |

**Create – POST `/api/admin/onboarding`**
**Request:** `multipart/form-data`. Field name **`images`**, multiple files (max 10). Creates **one** document with `onboardImage: [url1, url2, ...]`. No JSON body required.

**Admin list – GET `/api/admin/onboarding`**
**Query:** `page`, `limit`.
**Response:** Paginated list. Each item: `_id`, `onboardImage` (array of URLs), `createdAt`, `updatedAt`, `createdAtIST`, `updatedAtIST`.

**Update – PATCH `/api/admin/onboarding/:id`**
**Request:** `multipart/form-data`. Field name **`images`**, multiple files (max 10). Replaces the document’s `onboardImage` array with the new URLs.

**Public list – GET `/api/onboarding`**
**Query:** `limit` (optional, max 50, default 20).
**Response:** `{ "success": true, "data": { "list": [ { "_id", "onboardImage": ["url1", "url2", ...], "createdAt", "createdAtIST", ... } ] } }`. Sorted by `createdAt`. No auth required.

---

### 4.11 Staff Assignments

| Method | Path | Description |
|--------|------|-------------|
| POST | `/staff-assignments` | Assign staff to pump |
| GET | `/staff-assignments` | List assignments (with filters) |
| GET | `/employee-list` | Unassigned staff/managers list |
| GET | `/staff-assignments/staff/:staffId` | Assignments by staff |
| GET | `/staff-assignments/pump/:pumpId` | Staff by pump |
| DELETE | `/staff-assignments/:assignmentId` | Remove assignment |

**Assign – POST `/staff-assignments`**  
**Body (JSON):** `{ "staffId": "...", "pumpId": "..." }`.

**List – GET `/staff-assignments`**  
**Query:** `page`, `limit`, `staffId`, `pumpId`, `status`.  
**Response:** Paginated assignments.

**Unassigned list – GET `/employee-list`**  
**Query:** `type` = `staff` \| `manager` (required), `pumpId`, `search`, `page`, `limit`.  
**Response:** Paginated list of unassigned staff or managers.

**By staff – GET `/staff-assignments/staff/:staffId`**  
**By pump – GET `/staff-assignments/pump/:pumpId`**  
**Remove – DELETE `/staff-assignments/:assignmentId`**

**UI:** Assign staff to pump (dropdowns from pumps list + employee-list); table of assignments; per-pump and per-staff views; remove action.

---

### 4.11 Redemptions (Admin actions)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/redemptions/direct` | Direct redeem (deduct user points at a pump) |
| POST | `/redemptions/:id/approve` | Approve redemption |
| POST | `/redemptions/:id/reject` | Reject redemption (body: reason) |

**Direct redeem – POST `/redemptions/direct`**  
**Body (JSON):** `{ "userId": "...", "pointsToDeduct": 100, "pumpId": "..." }`.  
**Response:** `data` = redemption + pumpName.

**Approve – POST `/redemptions/:id/approve`**  
**Body (optional):** `{ "reason": "..." }`.  
**Response:** `data` = updated redemption.

**Reject – POST `/redemptions/:id/reject`**  
**Body (JSON):** `{ "reason": "required text" }`.  
**Response:** `data` = updated redemption (points refunded).

**List redemptions (all roles):**  
**Endpoint:** `GET /api/redeem` (not under `/api/admin`).  
**Auth:** Same JWT.  
**Query:** `page`, `limit`, `status`, `userId`.  
**Response:** Paginated list. Use for “pending redemptions” table and approve/reject actions.

**UI:** Redemption list (from `/api/redeem`); approve/reject buttons; “Direct redeem” form (user, points, pump).

---

### 4.12 User Registration + User Detail (Admin 360 Page)

Use this section to build one admin page where you can:
- register user in all customer account types,
- open user by ID and show full details,
- show user transactions and redemptions,
- create redemption for that user from admin,
- if user is owner, show full fleet and drill down to a specific vehicle.

#### 4.12.1 Registration APIs (all user account types)

You can use either:
- `POST /api/admin/users` (Admin JWT, recommended for admin panel).
- `POST /api/auth/register` (public app registration flow).

For admin frontend, use `POST /api/admin/users`.

**Content-Type:** `multipart/form-data` (supports photos and vehicle docs).

**A) Individual customer (admin create):**
```json
{
  "role": "user",
  "accountType": "individual",
  "mobile": "9876543210",
  "fullName": "Individual User",
  "email": "ind@example.com",
  "registeredPumpId": "<optionalPumpId>",
  "vehicle": {
    "vehicleNumber": "OD02AB1234",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

**B) Organization customer (registered owner):**
```json
{
  "role": "user",
  "accountType": "organization",
  "ownerType": "registered",
  "ownerIdentifier": "<existingOwnerId_or_mobile>",
  "mobile": "9876500001",
  "fullName": "Fleet Driver 1",
  "vehicle": {
    "vehicleNumber": "OD02CD5678",
    "vehicleType": "Commercial",
    "fuelType": "Diesel"
  }
}
```

**C) Organization customer (non-registered owner):**
```json
{
  "role": "user",
  "accountType": "organization",
  "ownerType": "non-registered",
  "owner": {
    "fullName": "Fleet Owner Name",
    "mobile": "9876500002",
    "email": "owner@example.com"
  },
  "mobile": "9876500003",
  "fullName": "Fleet Driver 2",
  "vehicle": {
    "vehicleNumber": "OD02EF9012",
    "vehicleType": "Commercial",
    "fuelType": "Diesel"
  }
}
```

**D) Owner only (no driver, no vehicle):**
```json
{
  "role": "user",
  "accountType": "organization",
  "ownerType": "non-registered",
  "ownerOnly": true,
  "owner": {
    "fullName": "New Fleet Owner",
    "mobile": "9876500004",
    "email": "newowner@example.com"
  }
}
```

#### 4.12.2 User detail page (by userId) — recommended API call order

1. Base profile:
   - `GET /api/admin/users/:userId`
2. Wallet:
   - `GET /api/user/:userId/wallet`
3. Transactions:
   - `GET /api/transactions?userId=:userId&page=1&limit=10`
4. Redemptions:
   - `GET /api/redeem?userId=:userId&page=1&limit=10`

Use the same Admin JWT for all above calls.

#### 4.12.3 Create redemption for user from Admin page

Use direct redemption API:
- `POST /api/admin/redemptions/direct`

**Body:**
```json
{
  "userId": "<userId>",
  "pointsToDeduct": 100,
  "pumpId": "<pumpId>"
}
```

This deducts points immediately and returns `redemption`, `redemptionCode`, and message.

#### 4.12.4 Owner full fleet details + specific vehicle drill-down

For owner users, the backend already supports fleet shape through lookup:
- `GET /api/user/scan/lookup?mobile=<ownerMobile>`
- or `GET /api/user/scan/lookup?loyaltyId=<ownerLoyaltyId>`

Response includes owner profile plus:
- `fleetVehicles` (vehicle objects + `driverId`, `driverFullName`, `driverMobile`)
- `totalFleetPoints`

To open a specific vehicle:
1. Pick one item from `fleetVehicles`.
2. Use `driverId` and vehicle identifiers from that item.
3. Fetch that driver vehicle list (or one vehicle):
   - `GET /api/user/vehicles?userId=<driverId>&vehicleId=<vehicleId>`
   - or `GET /api/user/vehicles?userId=<driverId>&vehicleNumber=<vehicleNumber>`
4. Fetch driver transactions/redemptions:
   - `GET /api/transactions?userId=<driverId>&page=1&limit=10`
   - `GET /api/redeem?userId=<driverId>&page=1&limit=10`

Note: admin transactions API filters by `userId` (not `vehicleId`). For vehicle-level screen, use selected driver + frontend filtering by `vehicleId` from transaction rows.

---

## 5. Quick Reference – All Admin Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/login` | Login (no auth) |
| GET | `/api/admin/me` | Current admin |
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/stats/review` | Review stats (query: date, time, pumpId, userId) |
| GET | `/api/admin/stats/user-registrations` | User registration graph (query: date, groupBy) |
| GET/POST | `/api/admin/users`, `/api/admin/users/:userId` | List **customers**, create, get **customer** by ID, update, status, delete |
| GET | `/api/admin/managers`, `/api/admin/managers/:managerId` | List all managers, get manager by ID (includes passwordViewable for admin) |
| GET | `/api/admin/staff`, `/api/admin/staff/:staffId` | List all staff, get staff by ID (includes passwordViewable for admin) |
| GET | `/api/admin/employee-list` | List **unassigned** managers or staff (query: type=staff\|manager) |
| GET/POST | `/api/admin/pumps`, `/api/admin/pumps/:pumpId` | List, create, get, update, delete (multipart for create/update) |
| POST | `/api/admin/wallet/adjust` | Adjust user points |
| GET/POST | `/api/admin/campaigns`, `.../:campaignId` | Campaigns CRUD |
| GET/POST | `/api/admin/banners`, `.../:bannerId` | Banners CRUD (form-data) |
| GET/POST | `/api/admin/rewards`, `.../:rewardId` | Rewards CRUD |
| GET/PATCH | `/api/admin/config` | System config |
| POST/GET/DELETE | `/api/admin/staff-assignments`, `.../employee-list`, etc. | Staff assignments |
| POST | `/api/admin/redemptions/direct` | Direct redeem |
| POST | `/api/admin/redemptions/:id/approve` | Approve redemption |
| POST | `/api/admin/redemptions/:id/reject` | Reject redemption |
| GET | `/api/redeem` | List redemptions (with Admin JWT) |

---

## 6. Error Handling & UX

- **401 Unauthorized:** Token missing or invalid → redirect to login, clear token.
- **403 Forbidden:** Valid token but not admin → show “Access denied”, optionally redirect.
- **404 Not Found:** Resource not found → show message, back to list or dashboard.
- **4xx validation errors:** Show field errors from response (e.g. `message` or `errors` array if backend sends one).
- **Network errors:** Retry or show “Something went wrong” and retry button.

---

## 7. Checklist for Connecting the Frontend

- [ ] **Backend:** Set `PASSWORD_VIEW_SECRET` in backend `.env` (min 16 chars) so admin can view manager/staff password in get-by-id responses (§8).
- [ ] Store backend base URL (e.g. env `VITE_API_BASE` or `NEXT_PUBLIC_API_BASE`).
- [ ] Implement `POST /api/admin/login` and store `accessToken` (and optionally refreshToken).
- [ ] Add axios/fetch interceptor: attach `Authorization: Bearer <accessToken>` to all requests to `/api/admin` and `/api/redeem`.
- [ ] Implement `GET /api/admin/me` on app load (or after login) and protect admin routes.
- [ ] Dashboard: call `GET /api/admin/dashboard`, map to KPI cards and recent transactions.
- [ ] Users: list customers (search, status, pagination), create (multipart), get, update, status, delete.
- [ ] Managers: list (`GET /managers`), get by ID (`GET /managers/:managerId`); edit/delete via `/users/:userId?type=manager`.
- [ ] Staff: list (`GET /staff`), get by ID (`GET /staff/:staffId`); edit/delete via `/users/:userId?type=staff`.
- [ ] Employee-list: `GET /employee-list?type=staff|manager` for unassigned list (assignment UI).
- [ ] Pumps: list (filters), create/update (multipart), get, delete.
- [ ] Stats: review stats and user-registrations with date/time filters and optional pumpId/userId; tables and charts.
- [ ] Campaigns, Banners, Rewards: CRUD; banners with form-data and image upload.
- [ ] Config: get + patch for points and expiry.
- [ ] Staff assignments: assign, list, employee-list, by staff/pump, delete.
- [ ] Redemptions: list via `GET /api/redeem`; direct redeem; approve/reject with reason.
- [ ] Wallet: adjust with userId, points, type, reason.
- [ ] Logout: clear token and redirect to login.

Use this guide together with [STATS_API_QUERY_GUIDE.md](./STATS_API_QUERY_GUIDE.md) and [BANNER_API_FORMDATA.md](./BANNER_API_FORMDATA.md) for detailed query and form-data behavior.

---

## 8. Backend environment (.env) — backend only

These variables go in the **backend** project’s `.env` file **only**. Do **not** put them in the frontend `.env`.

| Variable | Description |
|----------|-------------|
| `PASSWORD_VIEW_SECRET` | Secret key (min 16 chars) for AES encryption. Used to encrypt/decrypt manager and staff passwords so admin can view them in GET manager/staff by ID. **Backend `.env` only** — not frontend. |

**Add to backend `.env` (root of this backend repo):**
```env
# Admin view manager/staff password (AES key; min 16 chars). Backend .env only.
PASSWORD_VIEW_SECRET=your-secure-random-string-min-16-chars
```

If missing, the backend uses a default (change in production).

---

## 9. How to connect the frontend

### 9.1 Environment (frontend)

Create a `.env` (or `.env.local`) in your frontend project:

```env
# Backend API base (no trailing slash)
VITE_API_BASE=http://localhost:3000
# or for Create React App: REACT_APP_API_BASE=http://localhost:3000
# or for Next.js: NEXT_PUBLIC_API_BASE=http://localhost:3000
```

Use the variable that matches your framework so the frontend can call `GET ${API_BASE}/api/admin/...`.

### 9.2 Store token after login

After `POST /api/admin/login` succeeds:

- Read `data.accessToken` (and optionally `data.refreshToken`) from the response.
- Store in memory (e.g. React state/context), or in `localStorage` / `sessionStorage`, or in an httpOnly cookie if your backend sets it and the frontend is same-site.
- Store `data.user` for header/sidebar (name, email, etc.).

### 9.3 Attach token to every Admin / Redeem request

**Using fetch:**

```javascript
const token = getStoredAccessToken(); // your storage
const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

**Using axios:**

```javascript
import axios from 'axios';

const api = axios.create({ baseURL: process.env.VITE_API_BASE });

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Then: api.get('/api/admin/dashboard'), api.get('/api/admin/managers'), etc.
```

Use the same token for `GET /api/redeem` (list redemptions).

### 9.4 Protect admin routes

- On app load or when entering admin layout, call `GET /api/admin/me` with the stored token.
- If response is 401 or 403: clear token and redirect to login.
- If 200: consider admin logged in; render dashboard and sidebar.

### 9.5 Example: Manager list and view password

- **List:** `GET /api/admin/managers?page=1&limit=10&status=active&search=john`
- **Get one (with password for admin):** `GET /api/admin/managers/:managerId`

Response for get-by-id includes `data.passwordViewable` (plain password) so the admin UI can show it. Same for staff: `GET /api/admin/staff/:staffId` → `data.passwordViewable`.

### 9.6 CORS

Backend must allow your frontend origin (e.g. `http://localhost:5173`). Configure `CORS_ORIGIN` in backend `.env` (see backend config). If you use cookies, ensure credentials are sent and backend allows your origin.
