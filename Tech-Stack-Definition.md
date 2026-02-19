# Tech Stack Definition & Tech Rules

**Project:** Fuel Station Loyalty & QR Vehicle Reward System  
**Version:** 1.0  
**Last Updated:** February 18, 2026  
**Status:** Active  
**Document Classification:** Internal Use

---

## Document Control

| Version | Date       | Author | Changes                |
|---------|------------|--------|------------------------|
| 1.0     | Feb 18, 2026 | Team   | Initial tech stack definition |

---

## 1. Purpose & Scope

This document defines the **mandatory technology stack** and **technical rules** for the Fuel Loyalty backend and related integrations. It is the single source of truth for:

- **What** technologies and versions we use
- **How** we use them (conventions, security, API, database, and integration rules)

**Related documents:**

- **PRD:** `Fuel-Loyalty-System-PRD.md` — product requirements
- **Design Document:** `Fuel-Loyalty-System-Design-Document.md` — architecture and design

---

## 2. Technology Stack (Mandatory)

### 2.1 Backend

| Layer | Technology | Version / Constraint | Notes |
|-------|------------|----------------------|--------|
| Runtime | **Node.js** | LTS (e.g. 20.x or 22.x) | Backend API only |
| Framework | **Express.js** | Current stable | REST API; no other backend framework |
| Language | **JavaScript** (ESM) or **TypeScript** | — | Prefer ES modules (`import`/`export`) |

### 2.2 Database

| Layer | Technology | Version / Constraint | Notes |
|-------|------------|----------------------|--------|
| Primary DB | **MongoDB** | 6.x or 7.x | Single source of truth; replica set for HA |
| Cache | **No Redis** | — | Redis is not used; use in-memory or MongoDB for rate limit/session if needed |

### 2.3 Authentication & Security

| Layer | Technology | Notes |
|-------|------------|--------|
| Tokens | **JWT** | Access token (short-lived) + optional refresh token |
| Algorithm | HS256 or RS256 | Configurable via env |
| Password hashing | **Bcrypt** or **Argon2** | No plain text; min cost per framework docs |
| QR payload | **HMAC-SHA256** (signing); **AES-256** (optional encryption) | No raw DB IDs in QR; expiry in token |

### 2.4 File & Media

| Layer | Technology | Notes |
|-------|------------|--------|
| File storage | **Cloudinary** or **AWS S3** | Bill photos, receipts; stable URLs. **No QR images** — QR is generated on frontend from ID. |
| QR generation | **Frontend only** — free library (e.g. `qrcode`, `qrcode.react`) | Backend returns **loyaltyId** (and vehicleId) after registration; frontend generates QR from this ID. Backend **does not store** QR images or QR payload; only the ID is used for **verification** when scan or manual entry is sent. **No QR expiry** — the same ID is used for the lifetime of the vehicle. |

### 2.5 External Services

| Layer | Technology | Notes |
|-------|------------|--------|
| SMS | **Twilio** / **MSG91** / **AWS SNS** (one chosen) | OTP, alerts; provider-agnostic interface |
| Email | **SendGrid** / **AWS SES** / **Mailgun** (one chosen) | Welcome, receipts, notifications; template engine |
| Push | **Firebase Cloud Messaging (FCM)** | Mobile & web push; service account server-side |

---

## 3. Tech Rules

### 3.1 API Rules

- **Base path:** All REST APIs under `/api`.
- **Auth header:** `Authorization: Bearer <JWT>` for protected routes.
- **Response shape:**
  - Success: `{ success: true, message?: string, data?: T, meta?: { page, limit, total, totalPages } }`.
  - Error: HTTP status 4xx/5xx + `{ success: false, message: string, errors?: [] }`.
- **HTTP methods:** Use GET (read), POST (create), PUT/PATCH (update), DELETE (delete) as per REST.
- **Idempotency:** Support `Idempotency-Key` header for `POST /api/transactions` and `POST /api/redeem` (or equivalent) where applicable.
- **Validation:** Validate and sanitize all inputs (e.g. Joi, Zod); reject invalid payloads with 400 and clear message.

### 3.2 Authentication & Login Rules

- **User (customer):** Login by **OTP only** (no password).
  - Flow: send OTP to mobile → client submits mobile + OTP → server returns JWT.
  - Endpoints: `POST /api/auth/send-otp`, `POST /api/auth/verify-otp` (verify returns JWT for existing user).
- **Admin / Manager / Staff:** Login by **identifier + password**.
  - Identifier = one of: **email**, **username**, **phone number**, or **user ID** (string).
  - Endpoint: `POST /api/auth/login` with `identifier` and `password` → JWT.
- **Passwords:** Never store or log plain text; use Bcrypt/Argon2 only.
- **JWT:** Include `userId`, `role`, and (for manager/staff) pump scope in payload; validate on every protected request.

### 3.3 Authorization Rules

- **Roles:** `admin`, `manager`, `staff`, `user` (lowercase in code and DB).
- **RBAC:** Every protected route must check role (and pump assignment for manager/staff); return 403 if not allowed.
- **Pump scope:** Manager and Staff may only access data for their assigned pump(s); filter all queries by `pumpId` where relevant.
- **Resource ownership:** Users (role `user`) may only access their own profile, vehicles, wallet, transactions, redemptions.
- **Banners:** Admin can create/edit/delete banners (global or per store); Manager can create/edit/delete banners for **their specific store (pump)** only. Return only active banners (startTime ≤ now and endTime > now) to users; past endTime = auto-removed from list.
- **Fleet owner ID:** Fleet owner has their own User account with ID (and optional loyaltyId). When adding transactions, staff can scan/enter either vehicle/driver's loyaltyId (points to vehicle/driver) OR owner ID (points to owner's account for all vehicles).

### 3.4 Database Rules

- **Database:** MongoDB only; no Redis in current stack.
- **Naming:** Collections in PascalCase or camelCase (e.g. `users`, `Transactions`); fields in camelCase.
- **IDs:** Use MongoDB `ObjectId` for `_id`; expose as string in API (e.g. `userId`, `vehicleId`).
- **Indexes:** Create indexes per Design Document Section 3.3 (e.g. unique on `mobile`, `loyaltyId`, `(pumpId, billNumber)`).
- **No raw operator injection:** Never pass user input directly into `$where` or dynamic operators; use parameterized queries.
- **Audit:** Write to `AuditLogs` (or equivalent) for sensitive actions: user create, wallet adjust, redemption, campaign create (userId, entity, before/after).

### 3.5 Security Rules

- **HTTPS:** Enforce in production; no sensitive data over plain HTTP.
- **Secrets:** No secrets in code; use environment variables (e.g. `JWT_SECRET`, `MONGODB_URI`, API keys).
- **Rate limiting:** Apply per IP and per user (in-memory or MongoDB); stricter limits on auth and OTP endpoints.
- **Input:** Validate type, length, format; sanitize to prevent injection (NoSQL, XSS in stored data).
- **CORS:** Restrict origins in production; do not use `*` for credentials.

### 3.6 Integration Rules

- **SMS/Email:** Use a single provider per env; abstract behind an interface so provider can be swapped; log failures and retry where appropriate.
- **Firebase FCM:** Store FCM tokens per user; send via Admin SDK; persist notifications in DB for in-app list.
- **Cloudinary/S3:** Upload only allowed types/sizes; return stable URLs; use for QR images, bill photos (`attachments`), receipts.

### 3.7 Code & Repo Rules

- **Architecture:** **Clean Architecture (Controller → Service → Repository → Model)** in MVC-style. Controllers call Services only; Services call Repositories (and external APIs); Repositories use Mongoose Models only; no DB access from Controllers.
- **Folder structure:** `src/` with `config`, `constants`, `controllers`, `middlewares`, `models`, `repositories`, `services`, `utils`, `validation`, `seeders`, `routes`.
- **Modules:** Prefer ES modules (`import`/`export`); consistent file naming (e.g. `user.service.js`, `user.repository.js`, `User.model.js`).
- **Structure:** Routes wire to Controllers; Controllers → Services → Repositories → Models; cross-cutting: Middleware, Utils, Validation, Config, Constants, Seeders.
- **Errors:** Use a central error handler (middleware); map known errors to HTTP status and message; log with requestId/stack in non-dev.
- **Logging:** Structured (e.g. JSON); log level from env; no sensitive data (passwords, tokens) in logs.

### 3.8 Performance Rules

- **Targets:** API p95 &lt; 2 seconds; transaction processing &lt; 3 seconds (per PRD).
- **DB:** Use projection to limit returned fields; avoid full collection scans; maintain indexes as per Design Document.
- **No Redis:** Do not introduce Redis without updating this document and the Design Document.

---

## 4. Out of Scope (Do Not Use)

- **Redis** — Not part of current stack.
- **Paid QR services** — Use only free, local QR generation libraries.
- **Other backends** — No PHP, Python, or other runtimes for this API; Node.js + Express only.
- **Other primary databases** — No SQL as primary store for this system; MongoDB only.

---

## 5. Environment Variables (Required)

All of the following must be configured via environment (e.g. `.env`); never hardcode.

```env
# Server
NODE_ENV=development|production|staging
PORT=3000

# Database
MONGODB_URI=mongodb://...

# Auth
JWT_SECRET=...
JWT_EXPIRY=24h

# File storage (one of)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
# OR
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...

# SMS (one provider)
SMS_API_KEY=...
SMS_SENDER_ID=...

# Email
EMAIL_SERVICE_API_KEY=...

# Firebase (push)
# Service account JSON path or GOOGLE_APPLICATION_CREDENTIALS
```

---

## 6. References

- **Product Requirements Document:** `Fuel-Loyalty-System-PRD.md`
- **Design Document:** `Fuel-Loyalty-System-Design-Document.md`

---

*Update this document when the stack or tech rules change; keep PRD and Design Document in sync.*
