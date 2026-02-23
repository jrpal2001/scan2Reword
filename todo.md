# Backend Todo — Fuel Station Loyalty & QR Vehicle Reward System

**Last Updated:** February 23, 2026  
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
- [ ] **Structured logging** — In `utils`; JSON logs, log level from env, requestId; no secrets in logs (SKIPPED - using console.log instead)
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
- [x] **Refresh token** — `POST /api/auth/refresh`; refresh tokens stored in MongoDB (RefreshToken model); rotation on refresh; validates from DB; on expired/revoked refresh, logs out only that device (by fcmToken) and returns 401
- [x] **Logout** — `POST /api/auth/logout` (verifyJWT); optional body: `refreshToken`, `fcmToken`; device-specific logout when fcmToken provided, else revoke single token or all user tokens
- [x] **Multi-device login** — FCM tokens stored per user; refresh tokens per device with fcmToken, deviceInfo, ipAddress, userAgent; login/verifyOtp accept optional fcmToken, deviceInfo

---

## Authorization (RBAC)

- [x] **RBAC middleware** — Check `req.user.role` (admin, manager, staff, user) per route (`requireRoles`, `requireOwnResource`)
- [x] **Pump scope** — For manager/staff, restrict to assigned pump(s); `attachPumpScope` sets `req.allowedPumpIds`; `requirePumpAccess` checks `pumpId` in params/body
- [x] **Resource ownership** — `requireOwnResource(paramName)` for user role (customer) to access only own resource by `userId`
- [x] **Route guards** — Apply role/pump checks: `verifyJWT` → `requireRoles([...])` → `attachPumpScope` (manager/staff) → `requirePumpAccess` when needed; example: `GET /api/admin/me`

---

## Users & registration

*Layers: Model (User) → userRepository → userService / authService → authController, userController, adminController + validation.*

- [x] **User model** — `src/models/User.model.js`: _id, fullName, mobile (unique), email, passwordHash, role, walletSummary, referralCode (manager/staff), FcmTokens, ownerId (fleet), status, createdAt, updatedAt, createdBy
- [x] **userRepository** — `src/repositories/user.repository.js`: create, findById, findByMobile, findByReferralCode, findByIdentifier, update, list
- [x] **userService** — `src/services/user.service.js`: register (with referral handling), createUserByAdmin, createUserByManagerOrStaff; TODO: credit registration/referral points via pointsService
- [x] **Self-registration** — `POST /api/auth/register`; controller → userService; creates user + vehicle; returns userId, vehicleId, loyaltyId (frontend generates QR); optional referralCode (TODO: credit referral points)
- [x] **Admin create user** — `POST /api/admin/users`; Joi userValidation.createUser; adminController → userService.createUserByAdmin (admin only)
- [x] **Manager create user** — `POST /api/manager/users`; Joi userValidation.createUserByOperator; attachPumpScope; credit registration points to manager (TODO: config)
- [x] **Staff create user** — `POST /api/staff/users`; Joi userValidation.createUserByOperator; attachPumpScope; credit registration points to staff (TODO: config)
- [x] **Referral code** — Auto-generate referral code when admin creates manager/staff; `generateReferralCode()` in userService; `GET /api/user/referral-code` endpoint; validate on self-register; credit referral points from SystemConfig when user registers with referral code
- [x] **Registration points** — SystemConfig for points per registration (`points.registration`); credit in `createUserByManagerOrStaff()` via pointsService/ledger when manager/staff creates user
- [x] **Account types** — Support Individual and Organization (fleet) registration; **fleet owner** has their own User account with ID; fleet driver users have `ownerId` pointing to owner; registration supports registered owner (search by ID/phone) and non-registered owner (create owner + driver + vehicle); owner endpoints: search owner, add vehicle to fleet, get fleet vehicles. **accountType** only required for role=USER; for manager/staff creation, accountType is optional/ignored

---

## Vehicles

*Layers: Model → vehicleRepository → vehicleService → userController / vehicleController.*

- [x] **Vehicle model** — `src/models/Vehicle.model.js`: userId, vehicleNumber (unique), loyaltyId (unique), vehicleType, fuelType, brand, model, yearOfManufacture, status; **no** qrData, qrImageURL, qrExpiresAt
- [x] **vehicleRepository** — `src/repositories/vehicle.repository.js`: create, findById, findByUserId, findByLoyaltyId, findByVehicleNumber, update, list
- [x] **vehicleService** — `src/services/vehicle.service.js`: generateLoyaltyId (LOY + 8 digits), createVehicle, getVehiclesByUserId, getVehicleById, getVehicleByLoyaltyId
- [x] **GET vehicles** — `GET /api/user/vehicles`; vehicleController.getVehicles → vehicleService; optional `?userId` for admin/manager; include loyaltyId (no QR URLs)
- [x] **Add/edit vehicle** — `POST /api/user/vehicles` (Joi vehicleValidation.create), `PATCH /api/user/vehicles/:vehicleId` (Joi vehicleValidation.update); ownership check in controller
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
- [x] **Staff assignments** — `src/models/StaffAssignment.model.js`: userId, pumpId, status; used by RBAC to scope manager/staff to their pump(s); staff restricted to one manager and one pump; manager restricted to one pump
- [x] **Admin pump CRUD** — `POST /api/admin/pumps` (create), `GET /api/admin/pumps` (list), `GET /api/admin/pumps/:pumpId` (get), `PATCH /api/admin/pumps/:pumpId` (update), `DELETE /api/admin/pumps/:pumpId` (delete); Joi pumpValidation; assign manager via managerId; manager restricted to one pump only
- [x] **Manager/staff pump scope** — `attachPumpScope` middleware sets `req.allowedPumpIds`; manager gets pumps where `managerId = req.user._id`; staff gets pumps from `StaffAssignment`; all manager/staff queries filter by `req.allowedPumpIds`

---

## Transactions

*Layers: Model → transactionRepository → transactionService (+ pointsService, campaignService) → transactionController.*

- [x] **Transaction model** — `src/models/Transaction.model.js`: pumpId, vehicleId (optional if owner QR used), userId (vehicle/driver OR owner if owner QR scanned), operatorId, amount, **liters**, category, billNumber (unique per pump), paymentMode, pointsEarned, campaignId, status, **attachments**, createdAt, updatedAt
- [x] **transactionRepository** — create, findById, findByPumpAndBillNumber (duplicate check), list (filters, pagination, pump scope)
- [x] **transactionService** — createTransaction (validate identifier: loyaltyId → vehicle/driver user, **owner ID → owner user**; duplicate check, points calculation via pointsService, campaign lookup placeholder), listTransactions; file upload URLs attached
- [x] **Points calculation** — `src/services/points.service.js`: Fuel = f(liters, 1 point/liter); others = f(amount, 5 points/₹100); campaign multiplier placeholder (TODO: integrate campaign lookup)
- [x] **POST /api/transactions** — Controller → transactionService; body includes identifier (loyaltyId for vehicle/driver OR **owner ID** for fleet owner); Joi validation; liters/attachments validated in service for Fuel
- [x] **File upload** — Middleware `uploadFilesToCloudinary` (multer + Cloudinary); uploads files, attaches URLs to `req.uploadedFiles`; transactionService saves in transaction.attachments
- [x] **GET transactions** — `GET /api/transactions`; Controller → transactionService → transactionRepository; pump-scoped for manager/staff via `req.allowedPumpIds`
- [x] **Idempotency** — Optional `Idempotency-Key` header middleware (`src/middlewares/idempotency.middleware.js`); `IdempotencyKey` model stores keys with 24h expiry; integrated into `POST /api/transactions` route; returns cached response if key already processed
- [x] **Indexes** — pumpId, vehicleId, userId, (pumpId, billNumber) unique, createdAt

---

## Points & wallet

- [x] **PointsLedger model** — `src/models/PointsLedger.model.js`: userId, transactionId, redemptionId, type (credit/debit/expiry/adjustment/refund), points (signed), balanceAfter, expiryDate (credits), reason, createdBy, createdAt
- [x] **Wallet summary** — On user: totalEarned, availablePoints, redeemedPoints, expiredPoints; updated automatically on ledger changes via pointsService
- [x] **GET wallet** — `GET /api/users/:userId/wallet`; returns wallet summary and ledger (with pagination); user can access own, admin/manager/staff can access any
- [x] **Manual adjustment** — `POST /api/admin/wallet/adjust`, `POST /api/manager/wallet/adjust` (manager pump-scoped); Joi validation; creates ledger entry; updates wallet summary
- [x] **Points expiry** — Configurable duration from SystemConfig (`pointsExpiry.durationMonths`); FIFO logic in `pointsLedgerRepository.findExpiringPoints()`; daily cron job (`src/jobs/pointsExpiry.job.js`) runs at 12:00 AM to expire points and create expiry ledger entries; notification job runs at 9:00 AM to send notifications (30/7/1 days before expiry) based on `pointsExpiry.notificationDays` from SystemConfig
- [x] **Indexes** — userId, createdAt, expiryDate, (userId, createdAt), transactionId, redemptionId on PointsLedger

---

## Campaigns

- [x] **Campaign model** — `src/models/Campaign.model.js`: name, type (multiplier/bonusPoints/bonusPercentage), multiplier/bonusPoints/bonusPercentage, startDate, endDate, conditions (minAmount, categories, userSegment, frequencyLimit), pumpIds (empty = all), createdBy, createdByRole (admin|manager), status
- [x] **Admin campaigns** — CRUD `POST/GET/PATCH/DELETE /api/admin/campaigns`; Joi validation; can set any pumpIds or global (empty array)
- [x] **Manager campaigns** — CRUD `POST/GET/PATCH/DELETE /api/manager/campaigns`; Joi validation; pumpIds restricted to manager's assigned pump(s) only; manager must assign to at least one pump
- [x] **Apply campaign** — In transaction points calculation: `campaignService.findActiveCampaignsForTransaction()` checks active campaigns (date, pump, category, min amount); applies multiplier/bonusPoints/bonusPercentage; first matching campaign applied; campaignId saved in transaction
- [x] **Indexes** — status, startDate, endDate, pumpIds, createdBy, (status, startDate, endDate) composite

---

## Banners

- [x] **Banner model** — `src/models/Banner.model.js`: title, description, imageUrl, linkUrl, startTime, endTime, pumpIds (empty = global), createdBy, createdByRole (admin|manager), status (active|expired), createdAt, updatedAt
- [x] **GET active banners** — `GET /api/banners` (public); filters startTime ≤ now and endTime > now; optional `?pumpId` query param; returns only active banners (auto-removal via query-time filter)
- [x] **Admin banners** — CRUD `POST/GET/PATCH/DELETE /api/admin/banners`; Joi validation; can set any pumpIds or global (empty array)
- [x] **Manager banners** — CRUD `POST/GET/PATCH/DELETE /api/manager/banners`; Joi validation; pumpIds restricted to manager's assigned pump(s) only; manager must assign to at least one pump — CRUD `/api/manager/banners`; only for manager’s pump(s)
- [x] **Auto-removal** — `bannerRepository.findActiveBanners()` returns only banners where endTime > now (no cron needed, query-time filter)
- [x] **Indexes** — startTime, endTime, pumpIds, status, (startTime, endTime) composite

---

## Rewards & redemptions

- [x] **Rewards model** — `src/models/Reward.model.js`: Catalog: name, type (discount/freeItem/cashback/voucher), pointsRequired, value, discountType (percentage/fixed/free), availability (unlimited/limited), totalQuantity, redeemedQuantity, validFrom, validUntil, applicablePumps (empty = all), status, description, imageUrl
- [x] **GET rewards** — `GET /api/rewards` (public); optional `?pumpId`; returns available rewards (active, within validity, available quantity)
- [x] **Redemption model** — `src/models/Redemption.model.js`: userId, rewardId (optional for at-pump), pointsUsed, redemptionCode (unique), status, approvedBy, usedAtPump, expiryDate (30 days), usedAt, rejectedReason, createdAt, updatedAt
- [x] **User redemption** — `POST /api/redeem` (user-initiated); Joi validation; validates balance, reward availability, expiry; deducts points via pointsService; creates redemption record (status: PENDING); updates reward redeemedQuantity
- [x] **At-pump redemption** — `POST /api/redeem/at-pump` or `POST /api/manager/redeem` or `POST /api/staff/redeem`; body: identifier (loyaltyId/owner ID/mobile), pointsToDeduct, pumpId; resolves user via scanService → deducts points → creates redemption (status: APPROVED, auto-approved)
- [x] **Approve/reject** — `POST /api/redeem/:id/approve`, `POST /api/redeem/:id/reject` (manager pump-scoped); reject refunds points and decrements reward quantity
- [x] **Verify redemption code** — `POST /api/redeem/:code/verify` (authenticated); validates code, expiry, status; returns redemption details
- [x] **Use redemption code** — `POST /api/redeem/:code/use` (admin/manager/staff); marks redemption as USED
- [x] **Idempotency** — Optional `Idempotency-Key` header middleware integrated into `POST /api/redeem` route; prevents duplicate redemption requests
- [x] **Indexes** — userId, status, redemptionCode (unique), expiryDate, (userId, status) composite on Redemptions; status, validFrom, validUntil, applicablePumps, pointsRequired on Rewards

---

## Notifications (Firebase FCM)

- [x] **FCM setup** — Firebase Admin SDK in `src/firebase/firebase.js`; service account from file (TODO: move to env)
- [x] **Subscribe token** — `POST /api/notifications/subscribeToken`; Joi validation; stores FCM token on user (FcmTokens array); subscribes to topic "all"
- [x] **GET my notifications** — `GET /api/notifications/my` (authenticated); returns notifications where user in users array; pagination support
- [x] **DELETE my notifications** — `DELETE /api/notifications/my` (body: notificationId(s)); remove user from notification’s user array
- [x] **Send to all** — `POST /api/notifications/all` (admin); send to topic “all”; save notification doc per user with FcmTokens for in-app list
- [x] **Send to users** — `POST /api/notifications/` (admin only); body: userIds, title, body, link?, img?; sends via FCM to user tokens; creates per-user notification docs
- [x] **Notification model** — `src/models/notification.model.js`: title, body, link, img, notificationTime, groupName, users (array of userIds), createdAt, updatedAt

---

## System config

- [x] **SystemConfig** — `src/models/SystemConfig.model.js`: Singleton model with registration points, referral points, fuel points per liter, other category rules (points per ₹100), points expiry duration (months), expiry notification days (array)
- [x] **Admin config APIs** — `GET /api/admin/config` and `PATCH /api/admin/config` (admin only); Joi validation; points.fuel/lubricant/store/service accept number or object; singleton pattern ensures only one config document

---

## File storage

- [x] **Cloudinary or S3** — Upload middleware (`src/middlewares/uploadToS3.js`) with multer + AWS S3; image compression using sharp (`src/utils/imageCompressor.js`) before upload; used for bill photos, receipts, user photos, vehicle RC photos
- [x] **Store URLs** — URLs saved in `transaction.attachments`, `user.profilePhoto/driverPhoto/ownerPhoto`, `vehicle.rcPhoto` after S3 upload
- [x] **Validation** — File type and size limits in `src/utils/multerConfig.js` (JPEG, PNG, PDF; 50MB limit); shared `userUploadFields` (profilePhoto, driverPhoto, ownerPhoto, rcPhoto) for user/registration routes

---

## Integrations

- [x] **SMS** — `src/utils/smsUtils.js` and `src/services/sms.service.js`: DLT provider (Edumarc/Combirds) via `smsUtils.js`; `sendSMS()`, `sendOTP()` methods with retry logic (3 attempts with exponential backoff); integrated into auth service for OTP sending; failure logging
- [x] **Email** — `src/services/email.service.js`: Nodemailer (SMTP) for email sending; `sendEmail()`, `sendWelcomeEmail()`, `sendReceiptEmail()`, `sendRedemptionConfirmationEmail()` methods; HTML templates; retry logic (3 attempts) and failure logging
- [x] **Firebase FCM** — See Notifications section above (already implemented)

---

## Security & validation

- [x] **Input validation** — Joi validation middleware (`validateRequest`) used throughout all routes; rejects invalid requests with 400 status
- [x] **No NoSQL injection** — All queries use parameterized Mongoose queries; no `$where` or dynamic operators; user input sanitized via Joi validation
- [x] **Rate limiting** — In-memory rate limiter (`src/middlewares/rateLimiter.middleware.js`); global limit (100 req/15min per IP); strict limit for auth endpoints (5 req/15min); per-user rate limiting available
- [x] **CORS** — Configured in `app.js` with `config.cors.origins` whitelist; credentials enabled; no `*` wildcard
- [x] **Audit log** — `AuditLog` model and service (`src/services/auditLog.service.js`); logs user.create, wallet.adjust, redemption.create, campaign.create with userId, entity, before/after states, IP, userAgent

---

## Admin & manager APIs

- [x] **Admin dashboard** — `GET /api/admin/dashboard` (`src/services/dashboard.service.js`); aggregate stats: users (total, new today/month, active), transactions (total, today, this month), revenue (today, this month, last month, growth %), points (total earned/redeemed/expired/available), redemptions (total, today, this month)
- [x] **Admin users** — `GET /api/admin/users` (list with filters: role, status, search), `GET /api/admin/users/:userId` (get by ID), `PATCH /api/admin/users/:userId` (update), `PATCH /api/admin/users/:userId/status` (block/unblock); all with audit logging
- [x] **Manager dashboard** — `GET /api/manager/dashboard` (`src/services/dashboard.service.js`); pump-scoped stats: transactions (today, this month), revenue (today, this month), points issued (today, this month), redemptions (today, this month)
- [ ] **Manager transactions** — List transactions for manager’s pump(s); filters and pagination
- [ ] **Organization (fleet)** — Owner: aggregate “all total fleet points” and per-vehicle points (users where ownerId = owner’s _id)

---

## Testing & quality

- [ ] **Unit tests** — Critical business logic (points calculation, validation helpers)
- [ ] **Integration tests** — Auth, registration, transaction create, redemption, scan/validate
- [x] **Env-based config** — All configuration centralized in `src/config/index.js`; no secrets hardcoded; all from `.env` file

---

## Deployment & ops

- [x] **MongoDB indexes** — Indexes defined in all models: User (mobile unique, referralCode unique, role, ownerId, status), Vehicle (userId, loyaltyId unique, vehicleNumber unique), Transaction (pumpId, vehicleId, userId, pumpId+billNumber unique, createdAt), PointsLedger (userId, createdAt, expiryDate, userId+createdAt composite, transactionId, redemptionId), Redemption (userId, status, redemptionCode unique, expiryDate), Campaign (status, startDate, endDate, pumpIds, createdBy, status+startDate+endDate composite), Banner (startTime, endTime, pumpIds, status, startTime+endTime composite), Notification (users, notificationTime), AuditLog (userId+createdAt, action+createdAt, entityType+entityId, createdAt)
- [x] **Health check** — `GET /health` and `GET /api/health` endpoints implemented in `app.js`; returns status and timestamp
- [ ] **Logging** — Structured (JSON); level from env; errors with stack and requestId
- [ ] **Documentation** — API list (endpoints, auth, request/response examples) — optional OpenAPI/Swagger

---

## Optional / later

- [x] **Refresh token** — Stored in MongoDB (RefreshToken model), rotation on refresh, device-specific logout on expiry (see Authentication section)
- [ ] OpenAPI/Swagger spec for API
- [ ] Redis for rate limit or cache (if introduced, update Tech Stack and Design Doc)

---

*Tick items as done; add new rows for sub-tasks if needed. Keep in sync with PRD and Design Document.*
