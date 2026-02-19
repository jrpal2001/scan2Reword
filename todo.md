# Backend Todo — Fuel Station Loyalty & QR Vehicle Reward System

**Last Updated:** February 18, 2026  
**References:** `Fuel-Loyalty-System-PRD.md`, `Fuel-Loyalty-System-Design-Document.md`, `Tech-Stack-Definition.md`

**Architecture:** Clean Architecture (Controller → Service → Repository → Model) in MVC-style folders.

---

## Architecture & folder structure

Backend follows **Controller → Service → Repository → Model** plus cross-cutting layers. Per feature: implement **Model** → **Repository** → **Service** → **Controller** (and **validation**), then wire in **routes** and **middlewares**.

- [ ] **Folder structure** — Create: `src/config`, `src/constants`, `src/controllers`, `src/middlewares`, `src/models`, `src/repositories`, `src/services`, `src/utils`, `src/validation`, `src/seeders`, `src/routes`
- [ ] **Config** — `src/config/db.js` (MongoDB connection), `src/config/index.js` or env loader (no secrets in code)
- [ ] **Constants** — `src/constants/roles.js`, `src/constants/status.js`, `src/constants/errorCodes.js` (enums, status values, magic strings)
- [ ] **Utils** — `asyncHandler`, `ApiResponse`, `ApiError`, logger (structured, requestId), any shared helpers
- [ ] **Middleware** — Error handler (central), auth (JWT), RBAC, rate limit, upload; place in `src/middlewares`
- [ ] **Validation** — Request validation (e.g. Joi/Zod) in `src/validation`; run in middleware or at controller entry
- [ ] **Seeder** — Seed scripts in `src/seeders` (e.g. admin user, system config, sample data); run via npm script or CLI
- [ ] **Rules** — Controllers call Services only; Services call Repositories (and external APIs); Repositories use Models only; no DB access from Controllers

---

## Project setup & foundation

- [ ] **Node.js + Express** — LTS Node, Express app, ESM (`import`/`export`)
- [ ] **MongoDB** — Connection in `src/config/db.js`; replica set for production
- [ ] **Env** — `.env` for `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRY`, file storage, SMS, Email, Firebase
- [ ] **Response envelope** — In `utils`: consistent `{ success, message?, data?, meta? }` and error shape (ApiResponse / ApiError)
- [ ] **Global error handler** — In `middlewares`; map to HTTP status and message
- [ ] **Structured logging** — In `utils`; JSON logs, log level from env, requestId; no secrets in logs
- [ ] **Health check** — `GET /health` or `/api/health` for liveness/readiness

---

## Authentication

*Layers: Model (User) → Repository (userRepository) → Service (authService) → Controller (authController) + validation + middleware.*

- [ ] **User model** — (See Users & registration; shared with auth)
- [ ] **userRepository** — findByMobile, findByEmail, findByIdentifier, create, update; no business logic
- [ ] **authService** — sendOtp, verifyOtp (login/register), loginWithPassword (resolve identifier → user, verify password), issueJwt
- [ ] **authController** — sendOtp, verifyOtp, login, refresh; call authService only
- [ ] **Validation** — Schemas for sendOtp, verifyOtp, login (identifier, password)
- [ ] **JWT** — Issue and verify access token (userId, role, pumpId for manager/staff); optional refresh token
- [ ] **User login (OTP)** — `POST /api/auth/send-otp` (mobile); `POST /api/auth/verify-otp` (mobile, otp) → return JWT for existing user
- [ ] **Admin/Manager/Staff login** — `POST /api/auth/login` with `identifier` (email/username/phone/id) + `password` → JWT; resolve identifier to user
- [ ] **Password hashing** — Bcrypt or Argon2 in service or utils; never store plain text
- [ ] **Auth middleware** — Verify JWT, attach `req.user` and role; 401 on invalid; in `middlewares`
- [ ] **OTP flow** — Generate, store (in-memory or DB), send via SMS in service; verify and invalidate; resend endpoint
- [ ] **Refresh token** — `POST /api/auth/refresh` (optional)

---

## Authorization (RBAC)

- [ ] **RBAC middleware** — Check `req.user.role` (admin, manager, staff, user) per route
- [ ] **Pump scope** — For manager/staff, restrict to assigned pump(s); filter queries by `pumpId`
- [ ] **Resource ownership** — User role can access only own profile, vehicles, wallet, transactions, redemptions
- [ ] **Route guards** — Apply role/pump checks to admin, manager, staff, and user routes

---

## Users & registration

*Layers: Model (User) → userRepository → userService / authService → authController, userController, adminController + validation.*

- [ ] **User model** — `src/models/User.model.js`: _id, fullName, mobile (unique), email, passwordHash, role, walletSummary, referralCode (manager/staff), FcmTokens, ownerId (fleet), status, createdAt, updatedAt, createdBy
- [ ] **userRepository** — create, findById, findByMobile, findByReferralCode, findByIdentifier, update, list (with filters/pagination)
- [ ] **userService** — register (with referral handling), createUserByAdmin, createUserByManager, createUserByStaff; credit registration/referral points via pointsService
- [ ] **Self-registration** — `POST /api/auth/register`; controller → authService/userService; OTP verify; create user + vehicle; return userId, vehicleId, loyaltyId; optional referralCode → credit referral points
- [ ] **Admin create user** — `POST /api/admin/users`; adminController → userService (admin only)
- [ ] **Manager create user** — `POST /api/manager/users`; credit registration points to manager (config)
- [ ] **Staff create user** — `POST /api/staff/users`; credit registration points to staff (config)
- [ ] **Referral code** — Generate/assign in userService for manager/staff; validate on self-register; credit referral points from SystemConfig
- [ ] **Registration points** — SystemConfig for points per registration; credit in userService via pointsService/ledger
- [ ] **Account types** — Support Individual and Organization (fleet); fleet driver users have `ownerId`; owner aggregate in userService

---

## Vehicles

*Layers: Model → vehicleRepository → vehicleService → userController / vehicleController.*

- [ ] **Vehicle model** — `src/models/Vehicle.model.js`: _id, userId, vehicleNumber (unique), loyaltyId (unique), vehicleType, fuelType, brand, model, yearOfManufacture, status; **no** qrData, qrImageURL, qrExpiresAt
- [ ] **vehicleRepository** — create, findById, findByUserId, findByLoyaltyId, findByVehicleNumber, update, list
- [ ] **vehicleService** — generateLoyaltyId (e.g. LOY + 8 digits), createVehicle, getVehicles, getVehicleById; used by userService in registration
- [ ] **GET vehicles** — Controller → vehicleService → vehicleRepository; include loyaltyId (no QR URLs)
- [ ] **Add/edit vehicle** — POST/PUT via vehicleService; ownership check in controller or service
- [ ] **Indexes** — userId, loyaltyId (unique), vehicleNumber (unique)

---

## Scan & verification

- [ ] **Validate ID** — `POST /api/scan/validate` or `POST /api/scan/qr`; body: ID (loyaltyId or vehicleId from QR/manual); lookup vehicle/user; return user/vehicle info for transaction or redemption
- [ ] **No QR generation on backend** — Only store and return IDs; no QR image storage or expiry

---

## Pumps & staff assignment

- [ ] **Pump model** — _id, name, code (unique), location, address, city, state, pincode, managerId, status, settings, timezone, currency
- [ ] **Staff assignments** — Staff assigned to pump(s); used by RBAC to scope manager/staff to their pump(s)
- [ ] **Admin pump CRUD** — Create, update, delete pumps; assign manager
- [ ] **Manager/staff pump scope** — All manager/staff queries filter by assigned pumpId(s)

---

## Transactions

*Layers: Model → transactionRepository → transactionService (+ pointsService, campaignService) → transactionController.*

- [ ] **Transaction model** — `src/models/Transaction.model.js`: pumpId, vehicleId, userId, operatorId, amount, **liters**, category, billNumber (unique per pump), paymentMode, pointsEarned, campaignId, status, **attachments**, createdAt, updatedAt
- [ ] **transactionRepository** — create, findById, findByPumpAndBillNumber (duplicate check), list (filters, pagination, pump scope)
- [ ] **transactionService** — createTransaction (validate, duplicate check, points calculation via pointsService, campaign lookup), listTransactions; call file upload util for attachments
- [ ] **Points calculation** — In pointsService or transactionService: Fuel = f(liters); others = f(amount); apply campaign multiplier
- [ ] **POST /api/transactions** — Controller → transactionService; validation middleware for body (liters required for Fuel, attachments for Fuel)
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
