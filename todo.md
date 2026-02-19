# Backend Todo — Fuel Station Loyalty & QR Vehicle Reward System

**Last Updated:** February 18, 2026  
**References:** `Fuel-Loyalty-System-PRD.md`, `Fuel-Loyalty-System-Design-Document.md`, `Tech-Stack-Definition.md`

**Architecture:** Clean Architecture (Controller → Service → Repository → Model) in MVC-style folders.

---

## Architecture & folder structure

Backend follows **Controller → Service → Repository → Model** plus cross-cutting layers. Per feature: implement **Model** → **Repository** → **Service** → **Controller** (and **validation**), then wire in **routes** and **middlewares**.

- [x] **Folder structure** — `src/config`, `src/constants`, `src/controllers`, `src/middlewares`, `src/models`, `src/repositories`, `src/services`, `src/utils`, `src/validation`, `src/seeders`, `src/routes`
- [x] **Config** — `src/config/db.js` (existing), `src/config/index.js` (env-based config)
- [x] **Constants** — `src/constants/roles.js`, `src/constants/status.js`, `src/constants/errorCodes.js`, `src/constants/index.js`
- [x] **Utils** — `asyncHandler`, `ApiResponse`, `ApiError` (existing)
- [x] **Middleware** — `src/middlewares/errorHandler.js`, `src/middlewares/auth.middleware.js` (verifyJWT)
- [x] **Validation** — Joi throughout: `auth.validation.js` (sendOtp, verifyOtp, login, register), `scan.validation.js`, `userValidation.js`, `vehicle.validation.js`, `admin.validation.js`; reusable `validateRequest(schema, source)` middleware in routes
- [x] **Seeder** — `src/seeders/` + README; existing `src/utils/seedAdmin.js` for Admin
- [x] **Rules** — Controllers → Services → Repositories → Models; no DB in Controllers

---

## Project setup & foundation

- [x] **Node.js + Express** — LTS Node, Express app, ESM (`import`/`export`)
- [x] **MongoDB** — Connection in `src/config/db.js`; replica set for production
- [x] **Env** — `.env` for `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET` / `ACCESS_TOKEN_SECRET`, `JWT_EXPIRY`, etc.
- [x] **Response envelope** — In `utils`: ApiResponse, ApiError (existing)
- [x] **Global error handler** — `src/middlewares/errorHandler.js`; used in `app.js`
- [ ] **Structured logging** — In `utils`; JSON logs, log level from env, requestId; no secrets in logs
- [x] **Health check** — `GET /health` and `GET /api/health` in `app.js`

---

## Authentication

*Layers: Model (User) → Repository (userRepository) → Service (authService) → Controller (authController) + validation + middleware.*

- [x] **User model** — `src/models/User.model.js` (UserLoyalty) with fullName, mobile, email, passwordHash, role, walletSummary, referralCode, FcmTokens, ownerId, status
- [x] **userRepository** — `src/repositories/user.repository.js`: findByMobile, findByEmail, findByIdentifier, create, update, list
- [x] **authService** — `src/services/auth.service.js`: sendOtp, verifyOtp (login/register), loginWithPassword, issueJwt, hashPassword
- [x] **authController** — `src/controllers/auth.controller.js`: sendOtp, verifyOtp, login (call authService only)
- [x] **Validation** — `src/validation/auth.validation.js`: sendOtp, verifyOtp, login (Joi)
- [x] **JWT** — issueJwt in authService; verify in `src/middlewares/auth.middleware.js` (verifyJWT)
- [x] **User login (OTP)** — `POST /api/auth/send-otp`, `POST /api/auth/verify-otp` → returns JWT for existing user
- [x] **Admin/Manager/Staff login** — `POST /api/auth/login` with `identifier` + `password` → JWT
- [x] **Password hashing** — Bcrypt in authService (hashPassword, compare in loginWithPassword)
- [x] **Auth middleware** — `src/middlewares/auth.middleware.js` (verifyJWT); attach req.user, req.userType
- [x] **OTP flow** — Generate, store in `Otp.model.js`, send via SMS stub; verify in verifyOtp; resend = sendOtp again
- [ ] **Refresh token** — `POST /api/auth/refresh` (optional)

---

## Authorization (RBAC)

- [x] **RBAC middleware** — Check `req.user.role` (admin, manager, staff, user) per route (`requireRoles`, `requireOwnResource`)
- [x] **Pump scope** — For manager/staff, restrict to assigned pump(s); `attachPumpScope` sets `req.allowedPumpIds`; `requirePumpAccess` checks `pumpId` in params/body
- [x] **Resource ownership** — `requireOwnResource(paramName)` for user role (customer) to access only own resource by `userId`
- [x] **Route guards** — Apply role/pump checks: `verifyJWT` → `requireRoles([...])` → `attachPumpScope` (manager/staff) → `requirePumpAccess` when needed; example: `GET /api/admin/me`

---

## Users & registration

*Layers: Model (User) → userRepository → userService / authService → authController, userController, adminController + validation.*

- [ ] **User model** — `src/models/User.model.js`: _id, fullName, mobile (unique), email, passwordHash, role, walletSummary, referralCode (manager/staff), FcmTokens, ownerId (fleet), status, createdAt, updatedAt, createdBy
- [x] **userRepository** — `src/repositories/user.repository.js`: create, findById, findByMobile, findByReferralCode, findByIdentifier, update, list
- [x] **userService** — `src/services/user.service.js`: register (with referral handling), createUserByAdmin, createUserByManagerOrStaff; TODO: credit registration/referral points via pointsService
- [x] **Self-registration** — `POST /api/auth/register`; controller → userService; creates user + vehicle; returns userId, vehicleId, loyaltyId (frontend generates QR); optional referralCode (TODO: credit referral points)
- [x] **Admin create user** — `POST /api/admin/users`; Joi userValidation.createUser; adminController → userService.createUserByAdmin (admin only)
- [x] **Manager create user** — `POST /api/manager/users`; Joi userValidation.createUserByOperator; attachPumpScope; credit registration points to manager (TODO: config)
- [x] **Staff create user** — `POST /api/staff/users`; Joi userValidation.createUserByOperator; attachPumpScope; credit registration points to staff (TODO: config)
- [ ] **Referral code** — Generate/assign in userService for manager/staff; validate on self-register; credit referral points from SystemConfig
- [ ] **Registration points** — SystemConfig for points per registration; credit in userService via pointsService/ledger
- [ ] **Account types** — Support Individual and Organization (fleet); **fleet owner** has their own User account with ID; fleet driver users have `ownerId` pointing to owner; owner aggregate in userService

---

## Vehicles

*Layers: Model → vehicleRepository → vehicleService → userController / vehicleController.*

- [x] **Vehicle model** — `src/models/Vehicle.model.js`: userId, vehicleNumber (unique), loyaltyId (unique), vehicleType, fuelType, brand, model, yearOfManufacture, status; **no** qrData, qrImageURL, qrExpiresAt
- [x] **vehicleRepository** — `src/repositories/vehicle.repository.js`: create, findById, findByUserId, findByLoyaltyId, findByVehicleNumber, update, list
- [x] **vehicleService** — `src/services/vehicle.service.js`: generateLoyaltyId (LOY + 8 digits), createVehicle, getVehiclesByUserId, getVehicleById, getVehicleByLoyaltyId
- [x] **GET vehicles** — `GET /api/user/vehicles`; vehicleController.getVehicles → vehicleService; optional `?userId` for admin/manager; include loyaltyId (no QR URLs)
- [x] **Add/edit vehicle** — `POST /api/user/vehicles` (Joi vehicleValidation.create), `PUT /api/user/vehicles/:vehicleId` (Joi vehicleValidation.update); ownership check in controller
- [x] **Indexes** — userId, loyaltyId (unique), vehicleNumber (unique)

---

## Scan & verification

- [x] **Scan service** — `src/services/scan.service.js`: validateIdentifier (resolves loyaltyId → vehicle/driver, **owner ID** → owner user, or mobile)
- [x] **Scan controller** — `src/controllers/scan.controller.js`: validateIdentifier endpoint
- [x] **Scan routes** — `src/routes/scan.routes.js`: `POST /api/scan/validate` returns user/vehicle info with `isOwner` flag
- [x] **Validate ID** — `POST /api/scan/validate`; body: `{ identifier }` (loyaltyId for vehicle/driver, **owner ID** for fleet owner, or mobile). Returns:
  - If **loyaltyId** → vehicle/driver user + vehicle info (points go to that vehicle/driver).
  - If **owner ID** → owner user info (points go to owner's account for all vehicles).
- [x] **No QR generation on backend** — Only store and return IDs; no QR image storage or expiry

---

## Pumps & staff assignment

- [x] **Pump model** — `src/models/Pump.model.js`: _id, name, code (unique), location (address, city, state, pincode, lat, lng), managerId, status, settings, timezone, currency
- [x] **Staff assignments** — `src/models/StaffAssignment.model.js`: userId, pumpId, status; used by RBAC to scope manager/staff to their pump(s)
- [x] **Admin pump CRUD** — `POST /api/admin/pumps` (create), `GET /api/admin/pumps` (list), `GET /api/admin/pumps/:pumpId` (get), `PUT /api/admin/pumps/:pumpId` (update), `DELETE /api/admin/pumps/:pumpId` (delete); Joi pumpValidation; assign manager via managerId
- [x] **Manager/staff pump scope** — `attachPumpScope` middleware sets `req.allowedPumpIds`; manager gets pumps where `managerId = req.user._id`; staff gets pumps from `StaffAssignment`; all manager/staff queries filter by `req.allowedPumpIds`

---

## Transactions

*Layers: Model → transactionRepository → transactionService (+ pointsService, campaignService) → transactionController.*

- [ ] **Transaction model** — `src/models/Transaction.model.js`: pumpId, vehicleId (optional if owner QR used), userId (vehicle/driver OR owner if owner QR scanned), operatorId, amount, **liters**, category, billNumber (unique per pump), paymentMode, pointsEarned, campaignId, status, **attachments**, createdAt, updatedAt
- [ ] **transactionRepository** — create, findById, findByPumpAndBillNumber (duplicate check), list (filters, pagination, pump scope)
- [ ] **transactionService** — createTransaction (validate identifier: loyaltyId → vehicle/driver user, **owner ID → owner user**; duplicate check, points calculation via pointsService, campaign lookup), listTransactions; call file upload util for attachments
- [ ] **Points calculation** — In pointsService or transactionService: Fuel = f(liters); others = f(amount); apply campaign multiplier
- [ ] **POST /api/transactions** — Controller → transactionService; body includes identifier (loyaltyId for vehicle/driver OR **owner ID** for fleet owner); validation middleware for body (liters required for Fuel, attachments for Fuel)
- [ ] **File upload** — Middleware (multer + Cloudinary/S3); attach URLs to req; transactionService saves in transaction.attachments
- [ ] **GET transactions** — Controller → transactionService → transactionRepository; pump-scoped for manager/staff
- [ ] **Idempotency** — Optional `Idempotency-Key` in middleware or transactionService
- [ ] **Indexes** — pumpId, vehicleId, userId, (pumpId, billNumber) unique, createdAt

---

## Points & wallet

- [ ] **PointsLedger model** — userId, transactionId, redemptionId, type (credit/debit/expiry/adjustment/refund), points, balanceAfter, expiryDate (credits), reason, createdBy, createdAt
- [ ] **Wallet summary** — On user: totalEarned, availablePoints, redeemedPoints, expiredPoints; update on ledger changes
- [ ] **GET wallet** — `GET /api/users/:userId/wallet` and ledger (with pagination), expiry schedule
- [ ] **Manual adjustment** — `POST /api/admin/wallet/adjust`, `POST /api/manager/wallet/adjust` (manager pump-scoped); create ledger entry; audit log
- [ ] **Points expiry** — Configurable duration (e.g. 12 months); FIFO; daily job to expire and create expiry ledger entries; optional notifications (30/7/1 days before)
- [ ] **Indexes** — userId, createdAt, expiryDate on PointsLedger

---

## Campaigns

- [ ] **Campaign model** — name, type, multiplier/bonusPoints/bonusPercentage, startDate, endDate, conditions, pumpIds (empty = all), createdBy, createdByRole (admin|manager), status
- [ ] **Admin campaigns** — CRUD `POST/GET/PUT/DELETE /api/admin/campaigns`; can set any pumpIds or global
- [ ] **Manager campaigns** — CRUD `POST/GET/PUT/DELETE /api/manager/campaigns`; pumpIds restricted to manager’s assigned pump(s) only
- [ ] **Apply campaign** — In transaction points calculation: check active campaigns (date, pump, category, min amount); apply multiplier/bonus
- [ ] **Indexes** — status, startDate, endDate, pumpIds

---

## Banners

- [ ] **Banner model** — title, description, imageUrl, linkUrl, startTime, endTime, pumpIds (empty = global), createdBy, createdByRole, status, createdAt, updatedAt
- [ ] **GET active banners** — `GET /api/banners`; filter startTime ≤ now and endTime > now; optional pumpId (no expiry/refresh for QR; this is banner end time)
- [ ] **Admin banners** — CRUD `/api/admin/banners`; global or per pumpIds
- [ ] **Manager banners** — CRUD `/api/manager/banners`; only for manager’s pump(s)
- [ ] **Auto-removal** — Return only banners where endTime > now (no cron needed if query-time filter)
- [ ] **Indexes** — startTime, endTime, pumpIds, status

---

## Rewards & redemptions

- [ ] **Rewards model** — Catalog: name, type, pointsRequired, value, discountType, availability, validFrom, validUntil, applicablePumps, status
- [ ] **GET rewards** — `GET /api/rewards` (list available rewards)
- [ ] **Redemption model** — userId, rewardId, pointsUsed, redemptionCode, status, approvedBy, usedAtPump, expiryDate, createdAt, updatedAt
- [ ] **User redemption** — `POST /api/redeem` (user-initiated); validate balance, min threshold, expiry; deduct points; create redemption record
- [ ] **At-pump redemption** — `POST /api/scan/redeem` or `POST /api/manager/redeem`; body: identifier (loyaltyId/mobile/vehicleId), pointsToDeduct; resolve user → deduct → create redemption
- [ ] **Approve/reject** — `POST /api/manager/redemptions/:id/approve`, `POST /api/manager/redemptions/:id/reject` (manager)
- [ ] **Verify redemption code** — `POST /api/redeem/:code/verify` (e.g. at pump)
- [ ] **Idempotency** — Optional for POST /redeem
- [ ] **Indexes** — userId, status, redemptionCode (unique) on Redemptions

---

## Notifications (Firebase FCM)

- [ ] **FCM setup** — Firebase Admin SDK; service account from env
- [ ] **Subscribe token** — `POST /api/notifications/subscribeToken`; store FCM token on user (FcmTokens array); subscribe to topic if used
- [ ] **GET my notifications** — `GET /api/notifications/my` (auth); list notifications where user in user array; pagination
- [ ] **DELETE my notifications** — `DELETE /api/notifications/my` (body: notificationId(s)); remove user from notification’s user array
- [ ] **Send to all** — `POST /api/notifications/all` (admin); send to topic “all”; save notification doc per user with FcmTokens for in-app list
- [ ] **Send to users** — `POST /api/notifications/` (admin); body userIds, title, body; send via FCM and save per-user notification docs
- [ ] **Notification model** — title, body, link, img, NotificationTime, groupName, user (array of userIds)

---

## System config

- [ ] **SystemConfig** (or first-doc config) — Registration points, referral points, fuel points per liter, other category rules (e.g. points per ₹100), points expiry duration, expiry notification days
- [ ] **Admin config APIs** — GET/PUT points rules and config (admin only)

---

## File storage

- [ ] **Cloudinary or S3** — Upload middleware (e.g. multer + Cloudinary/S3); use for bill photos and receipts only (no QR images)
- [ ] **Store URLs** — Save returned URLs in transaction.attachments and elsewhere as needed
- [ ] **Validation** — File type and size limits

---

## Integrations

- [ ] **SMS** — Provider-agnostic service (Twilio/MSG91/AWS SNS); send OTP and optional alerts; retry and log failures
- [ ] **Email** — Send welcome, receipts, redemption confirmations; template engine; track failures
- [ ] **Firebase FCM** — See Notifications section above

---

## Security & validation

- [ ] **Input validation** — Joi or Zod for all request bodies; reject invalid with 400 and message
- [ ] **No NoSQL injection** — Never pass user input into `$where` or dynamic operators; parameterized queries only
- [ ] **Rate limiting** — Per IP and per user (in-memory or MongoDB); stricter on auth and OTP endpoints
- [ ] **CORS** — Restrict origins in production; do not use `*` with credentials
- [ ] **Audit log** — Log sensitive actions (user create, wallet adjust, redemption, campaign create) with userId, entity, before/after to AuditLogs collection

---

## Admin & manager APIs

- [ ] **Admin dashboard** — `GET /api/admin/dashboard` (aggregate stats: users, transactions, points, redemptions)
- [ ] **Admin users** — List, get, update, block users
- [ ] **Manager dashboard** — `GET /api/manager/dashboard` or pump-scoped stats
- [ ] **Manager transactions** — List transactions for manager’s pump(s); filters and pagination
- [ ] **Organization (fleet)** — Owner: aggregate “all total fleet points” and per-vehicle points (users where ownerId = owner’s _id)

---

## Testing & quality

- [ ] **Unit tests** — Critical business logic (points calculation, validation helpers)
- [ ] **Integration tests** — Auth, registration, transaction create, redemption, scan/validate
- [ ] **Env-based config** — No secrets in code; all from env

---

## Deployment & ops

- [ ] **MongoDB indexes** — Create all recommended indexes (see Design Document 3.3)
- [ ] **Health check** — Used by load balancer or orchestrator
- [ ] **Logging** — Structured (JSON); level from env; errors with stack and requestId
- [ ] **Documentation** — API list (endpoints, auth, request/response examples) — optional OpenAPI/Swagger

---

## Optional / later

- [ ] Refresh token rotation and blocklist (in-memory or DB)
- [ ] OpenAPI/Swagger spec for API
- [ ] Redis for rate limit or cache (if introduced, update Tech Stack and Design Doc)

---

*Tick items as done; add new rows for sub-tasks if needed. Keep in sync with PRD and Design Document.*
