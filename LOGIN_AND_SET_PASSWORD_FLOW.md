# 🔐 Login & Set Password Flow — Flutter Developer Guide

> **Base URL**: `https://<your-server>/api`
>
> All request/response bodies are **JSON** (`Content-Type: application/json`).
>
> Tokens: `accessToken` (short-lived JWT) and `refreshToken` (long-lived). Store both securely (e.g. `flutter_secure_storage`).

---

## 📋 Quick Summary

| Role | Login Method | Password Flow |
|---|---|---|
| **Admin** | Email + Password (always) | Password already set by seed/DB. No OTP. |
| **Manager** | First time → OTP → Set Password. Then → Password login | Must set password after first OTP login |
| **Staff** | First time → OTP → Set Password. Then → Password login | Must set password after first OTP login |

---

## 🔁 Overall Login Flow (All Roles)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        STEP 1: Check Login                         │
│                   POST /api/auth/login                              │
│                   Body: { "identifier": "<email_or_mobile>" }       │
│                                                                     │
│   Response tells you WHO the user is and WHAT to do next:           │
│   {                                                                 │
│     "isAdmin": true/false,                                          │
│     "isManager": true/false,                                        │
│     "isStaff": true/false,                                          │
│     "requiresPasswordSet": true/false                               │
│   }                                                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         isAdmin=true    isManager/isStaff   isManager/isStaff
                           requiresPassword   requiresPassword
                           Set = false        Set = true
              │                │                │
              ▼                ▼                ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
      │ STEP 2A:     │ │ STEP 2B:     │ │ STEP 2C:             │
      │ Verify       │ │ Verify       │ │ OTP Flow →           │
      │ Password     │ │ Password     │ │ Set Password         │
      │ (Admin)      │ │ (Mgr/Staff)  │ │ (First-time login)   │
      └──────────────┘ └──────────────┘ └──────────────────────┘
```

---

## 🟣 Flow A — Admin Login

Admin **always** logs in with email + password. No OTP involved.

### Step 1: Check Login

```
POST /api/auth/login
```

**Request:**
```json
{
  "identifier": "admin@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isAdmin": true
  },
  "message": "Login check successful"
}
```

> **Flutter Action**: When `isAdmin == true`, show the **password input screen**.

---

### Step 2: Verify Password

```
POST /api/auth/verify-password
```

**Request:**
```json
{
  "identifier": "admin@example.com",
  "password": "admin123",
  "fcmToken": "<optional-firebase-token>",
  "deviceInfo": {
    "deviceId": "abc123",
    "deviceName": "iPhone 15",
    "platform": "ios",
    "appVersion": "1.0.0"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "fullName": "Admin Name",
      "email": "admin@example.com",
      "role": "admin",
      "status": "active"
    },
    "token": "<accessToken>",
    "refreshToken": "<refreshToken>"
  },
  "message": "Login successful"
}
```

> **Flutter Action**: Store `token` and `refreshToken`. Navigate to **Admin Dashboard**.

---

### Alternative: Admin Legacy Login (Web Panel)

There is also a separate admin login endpoint used by the web dashboard:

```
POST /api/admin/login
```

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response:** Same structure as above (returns `user`, `accessToken`, `refreshToken`). Also sets HTTP-only cookies.

> **⚠️ Note for Flutter**: Use the `/api/auth/login` → `/api/auth/verify-password` flow. The `/api/admin/login` route is for the **web panel only** (uses cookies).

---

## 🟢 Flow B — Manager Login (Password Already Set)

When a Manager has **already set their password** (`requiresPasswordSet: false`).

### Step 1: Check Login

```
POST /api/auth/login
```

**Request:**
```json
{
  "identifier": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isAdmin": false,
    "isManager": true,
    "isStaff": false,
    "isIndividualUser": false,
    "isFleetOwner": false,
    "isFleetDriver": false,
    "requiresPasswordSet": false
  },
  "message": "Login check successful"
}
```

> **Flutter Action**: `requiresPasswordSet == false` → Show **password input screen**.

---

### Step 2: Verify Password

```
POST /api/auth/verify-password
```

**Request:**
```json
{
  "identifier": "9876543210",
  "password": "mySecurePass123",
  "fcmToken": "<optional>",
  "deviceInfo": { ... }
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "...",
      "fullName": "Manager Name",
      "mobile": "9876543210",
      "role": "manager",
      "status": "active"
    },
    "token": "<accessToken>",
    "refreshToken": "<refreshToken>"
  },
  "message": "Login successful"
}
```

> **Flutter Action**: Store tokens. Navigate to **Manager Dashboard**.

---

## 🟡 Flow C — Manager/Staff First-Time Login (Set Password)

When `requiresPasswordSet: true` — this is the **first-time login** for a Manager or Staff.

### Step 1: Check Login

```
POST /api/auth/login
```

**Request:**
```json
{
  "identifier": "9123456789"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isAdmin": false,
    "isManager": false,
    "isStaff": true,
    "requiresPasswordSet": true
  },
  "message": "Login check successful"
}
```

> **Flutter Action**: `requiresPasswordSet == true` → Start **OTP verification flow**.

---

### Step 2: Send OTP

```
POST /api/auth/send-otp
```

**Request:**
```json
{
  "mobile": "9123456789",
  "purpose": "login"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully"
  },
  "message": "OTP sent successfully"
}
```

> **Flutter Action**: Navigate to **OTP input screen**.

> **🧪 Testing Tip**: Use OTP `123456` — this is a hardcoded test OTP that always works (bypasses SMS verification).

---

### Step 3: Verify OTP

```
POST /api/auth/verify-otp
```

**Request:**
```json
{
  "mobile": "9123456789",
  "otp": "123456",
  "purpose": "login",
  "fcmToken": "<optional>",
  "deviceInfo": { ... }
}
```

**Response (Staff first-time):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "staff_id_here",
      "fullName": "Staff Name",
      "mobile": "9123456789",
      "role": "staff"
    },
    "token": "<accessToken>",
    "refreshToken": "<refreshToken>",
    "requiresPasswordSet": true,
    "isManager": false,
    "isStaff": true,
    "isIndividualUser": false,
    "isFleetOwner": false,
    "isFleetDriver": false
  },
  "message": "Login successful. Please set your password."
}
```

> **Flutter Action**: `requiresPasswordSet == true` → Store the `token` (you need it for the next call). Navigate to **Set Password screen**.

---

### Step 4: Set Password

```
POST /api/auth/set-password
```

**Headers:**
```
Authorization: Bearer <accessToken from Step 3>
```

**Request:**
```json
{
  "password": "myNewPassword123"
}
```

**Validation Rules:**
- Password must be **at least 6 characters**

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "message": "Password set successfully"
  },
  "message": "Password set successfully"
}
```

> **Flutter Action**: Password is now set! Navigate to **Dashboard** (user is already authenticated from Step 3).

> **⚠️ Important**: Only **Manager** and **Staff** roles can call this endpoint. If any other role tries, it returns `403 Forbidden`.

---

## 🔄 Token Refresh

When the `accessToken` expires, use the `refreshToken` to get a new one **without re-login**.

```
POST /api/auth/refresh
```

**Request:**
```json
{
  "refreshToken": "<your-stored-refreshToken>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "<new-accessToken>",
    "refreshToken": "<new-refreshToken>",
    "user": { ... }
  },
  "message": "Token refreshed successfully"
}
```

> **Flutter Action**: Replace stored tokens with the new ones. Retry the failed request.

---

## 🚪 Logout

```
POST /api/auth/logout
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request (recommended — logout current device):**
```json
{
  "fcmToken": "<your-fcm-token>"
}
```

**Other logout options:**
```json
// Logout specific session:
{ "refreshToken": "<refreshToken>" }

// Logout from ALL devices (send empty body):
{}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "message": "Logged out successfully"
}
```

---

## 🧩 Flutter Decision Tree (Pseudo-code)

```dart
// 1. Call POST /api/auth/login with identifier
final loginCheck = await api.checkLogin(identifier);

if (loginCheck.isAdmin) {
  // → Show password screen
  // → Call POST /api/auth/verify-password
  // → Navigate to Admin Dashboard
}
else if (loginCheck.isManager || loginCheck.isStaff) {
  if (loginCheck.requiresPasswordSet) {
    // FIRST-TIME LOGIN:
    // → Call POST /api/auth/send-otp
    // → Show OTP screen
    // → Call POST /api/auth/verify-otp (returns token)
    // → Show Set Password screen
    // → Call POST /api/auth/set-password (with Bearer token)
    // → Navigate to Dashboard
  } else {
    // RETURNING LOGIN:
    // → Show password screen
    // → Call POST /api/auth/verify-password
    // → Navigate to Dashboard
  }
}
```

---

## 📌 API Endpoints Summary

| # | Endpoint | Method | Auth Required | Purpose |
|---|---|---|---|---|
| 1 | `/api/auth/login` | POST | ❌ | Check who the user is (Step 1 for all roles) |
| 2 | `/api/auth/verify-password` | POST | ❌ | Login with password (Admin always, Manager/Staff after password set) |
| 3 | `/api/auth/send-otp` | POST | ❌ | Send OTP to mobile number |
| 4 | `/api/auth/verify-otp` | POST | ❌ | Verify OTP and get token |
| 5 | `/api/auth/set-password` | POST | ✅ Bearer Token | Set password (Manager/Staff only, first-time) |
| 6 | `/api/auth/refresh` | POST | ❌ | Refresh expired accessToken |
| 7 | `/api/auth/logout` | POST | ✅ Bearer Token | Logout (current device, specific session, or all) |
| 8 | `/api/admin/login` | POST | ❌ | Admin login (web panel only — uses cookies) |

---

## ⚠️ Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description here",
  "errorCode": "ERROR_CODE"
}
```

**Common error codes:**

| HTTP Status | Error | When |
|---|---|---|
| `400` | `OTP not found or expired` | Invalid/expired OTP |
| `401` | `Invalid identifier or password` | Wrong password |
| `401` | `Password not set. Please login with OTP first and set your password.` | Manager/Staff tries password login before setting password |
| `401` | `Unauthorized — No token provided` | Missing Bearer token on protected route |
| `401` | `Token expired` | Access token expired (use refresh) |
| `403` | `Only Manager or Staff can set password via this endpoint` | Non-Manager/Staff tries to set password |
| `404` | `Identifier not found` | User doesn't exist |

---

## 🔑 Key Points for Flutter Developers

1. **Always start with `/api/auth/login`** — it tells you exactly what to show next.
2. **`identifier`** can be a **mobile number** (for Manager/Staff) or **email** (for Admin).
3. **Test OTP**: Use `123456` — it always passes (hardcoded for development).
4. **Store tokens securely** — use `flutter_secure_storage` package.
5. **Set password is one-time** — after Manager/Staff sets their password, they use password login going forward.
6. **Token refresh** — implement an HTTP interceptor (e.g. with `dio`) to automatically refresh tokens on 401.
7. **FCM Token** — send it during login/OTP verification for push notification support.
8. **`deviceInfo`** — optional but recommended for multi-device tracking:
   ```json
   {
     "deviceId": "unique-device-id",
     "deviceName": "Pixel 7",
     "platform": "android",
     "appVersion": "1.2.0"
   }
   ```
