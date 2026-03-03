# How to Test Change Password APIs – Step by Step

Use **Postman**, **Thunder Client**, **Insomnia**, or **curl**. Base URL: `http://localhost:3000` (or your `PORT` from `.env`).

---

## Part 1: Change password **with** Bearer token (no old password / OTP)

When the user is **already logged in**, they only send a valid token + new password.

### Step 1.1 – Get an access token

Log in as **Admin**, **Manager**, or **Staff** (password login), or as **User** (OTP login). Use the same login flow you already use in the app.

**Option A – Admin (email + password)**

1. **POST** `http://localhost:3000/api/auth/login`  
   Body (JSON): `{ "identifier": "admin@example.com" }`  
   (Replace with your Admin email.)
2. Then **POST** `http://localhost:3000/api/auth/verify-password`  
   Body (JSON):  
   `{ "identifier": "admin@example.com", "password": "your_current_admin_password" }`  
   Response will contain `token` (access token). Copy it.

**Option B – Manager or Staff (identifier + password)**

1. **POST** `http://localhost:3000/api/auth/verify-password`  
   Body (JSON):  
   `{ "identifier": "manager@example.com", "password": "current_password" }`  
   (Use manager/staff email, phone, or code as `identifier`.)  
   Copy the `token` from the response.

**Option C – User / Customer (OTP login)**

1. **POST** `http://localhost:3000/api/auth/send-otp`  
   Body: `{ "mobile": "9876543210", "purpose": "login" }`
2. Use the OTP received (SMS or test OTP `123456` if enabled).
3. **POST** `http://localhost:3000/api/auth/verify-otp`  
   Body: `{ "mobile": "9876543210", "otp": "123456", "purpose": "login" }`  
   Copy the `token` from the response.

### Step 1.2 – Call change-password with the token

1. **POST** `http://localhost:3000/api/auth/change-password`
2. **Headers**
   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer <paste_access_token_here>`
3. **Body (JSON)**  
   `{ "newPassword": "MyNewSecurePass123" }`  
   (Must be at least 6 characters.)

### Step 1.3 – Check the result

- **Success (200):**  
  `{ "success": true, "message": "Password changed successfully", "data": { "message": "Password changed successfully" } }`
- **No/invalid token (401):** Unauthorized or “Invalid token”.

### Step 1.4 – Confirm the new password

- Log in again using the **new** password (verify-password for Admin/Manager/Staff, or send-otp + verify-otp for User).  
  It should succeed with the new password and fail with the old one.

---

## Part 2: Change password **without** Bearer token (verify with old password or OTP)

When there is **no** `Authorization: Bearer ...` header, the API requires either **old password** or **OTP** in the body.

---

### Flow A – Verify with **old password** (Admin / Manager / Staff)

Use this when the user knows their current password (e.g. forgot to send token, or testing from a different client).

**Step 2A.1 – Request**

1. **POST** `http://localhost:3000/api/auth/change-password-with-verification`
2. **Headers:** `Content-Type: application/json`  
   **Do not** send `Authorization` header.
3. **Body (JSON):**  
   `{ "identifier": "manager@example.com", "oldPassword": "current_password", "newPassword": "NewPass456" }`  
   - `identifier`: same as login (email, phone, or manager/staff code).  
   - `oldPassword`: current password.  
   - `newPassword`: new password (min 6 characters).

**Step 2A.2 – Response**

- **Success (200):**  
  `{ "success": true, "message": "Password changed successfully", "data": { "message": "Password changed successfully" } }`
- **Wrong old password (401):** “Invalid identifier or password”.

**Step 2A.3 – Confirm**

- Log in with **new** password via `POST /api/auth/verify-password` and same `identifier`.  
  Then (optional) test again with old password; it should fail.

---

### Flow B – Verify with **OTP** (any account: Admin / User / Manager / Staff by mobile)

Use this when the user does not have a token and may not remember the old password (e.g. “forgot password” flow).

**Step 2B.1 – Request OTP for change-password**

1. **POST** `http://localhost:3000/api/auth/send-otp`
2. **Headers:** `Content-Type: application/json`
3. **Body (JSON):**  
   `{ "mobile": "9876543210", "purpose": "change-password" }`  
   - Use the **mobile number** linked to the account (Admin uses `phone` in DB; for testing use the same number you use for that account).  
   - `purpose` must be exactly `"change-password"`.

**Step 2B.2 – Get the OTP**

- From SMS, or use test OTP **`123456`** if your app allows it (no real SMS sent).

**Step 2B.3 – Change password with OTP**

1. **POST** `http://localhost:3000/api/auth/change-password-with-verification`
2. **Headers:** `Content-Type: application/json`  
   **Do not** send `Authorization` header.
3. **Body (JSON):**  
   `{ "mobile": "9876543210", "otp": "123456", "newPassword": "AnotherNewPass789" }`  
   - Same `mobile` as in Step 2B.1.  
   - `otp`: the OTP you received (or `123456` for test).  
   - `newPassword`: at least 6 characters.

**Step 2B.4 – Response**

- **Success (200):**  
  `{ "success": true, "message": "Password changed successfully", "data": { "message": "Password changed successfully" } }`
- **Invalid/expired OTP (400):** “OTP not found or expired” or “Invalid OTP”.
- **Wrong mobile (404):** “No account found for this mobile number”.

**Step 2B.5 – Confirm**

- For Admin/Manager/Staff: log in with **new** password via `verify-password` (identifier + new password).  
- For User: use `send-otp` (purpose `login`) + `verify-otp`; they do not use password login, but their stored `passwordHash` is updated for future use.

---

## Quick reference

| Scenario                         | Endpoint                              | Auth header      | Body                                                                 |
|----------------------------------|---------------------------------------|------------------|----------------------------------------------------------------------|
| Change with token                | `POST /api/auth/change-password`      | `Bearer <token>` | `{ "newPassword": "..." }`                                          |
| Change with old password         | `POST /api/auth/change-password-with-verification` | None     | `{ "identifier": "...", "oldPassword": "...", "newPassword": "..." }`  |
| Change with OTP                  | `POST /api/auth/change-password-with-verification` | None     | `{ "mobile": "...", "otp": "...", "newPassword": "..." }`           |
| Get OTP for change-password      | `POST /api/auth/send-otp`             | None             | `{ "mobile": "10-digit", "purpose": "change-password" }`            |

---

## curl examples

Replace `BASE=http://localhost:3000` if your server runs on another port.

**1. Change password with token**

```bash
BASE=http://localhost:3000
TOKEN="your_access_token_here"

curl -X POST "$BASE/api/auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"newPassword":"MyNewPass123"}'
```

**2. Change password with old password (no token)**

```bash
curl -X POST "http://localhost:3000/api/auth/change-password-with-verification" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@example.com","oldPassword":"oldpass","newPassword":"NewPass123"}'
```

**3. Send OTP for change-password, then change with OTP**

```bash
# Send OTP
curl -X POST "http://localhost:3000/api/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{"mobile":"9876543210","purpose":"change-password"}'

# Change password with OTP (use OTP from SMS or 123456 for test)
curl -X POST "http://localhost:3000/api/auth/change-password-with-verification" \
  -H "Content-Type: application/json" \
  -d '{"mobile":"9876543210","otp":"123456","newPassword":"NewPass789"}'
```

---

## Common errors

- **401 Unauthorized** on `change-password`: Missing or invalid/expired Bearer token. Log in again and use a fresh token.
- **400 “Provide either (identifier + oldPassword) or (mobile + otp)”**: On `change-password-with-verification` you must send either both `identifier` and `oldPassword`, or both `mobile` and `otp` (and always `newPassword`).
- **400 “OTP not found or expired”**: Wrong `purpose` (must be `change-password` when using OTP for this flow), wrong mobile, or OTP expired (e.g. after 10 minutes). Request a new OTP with `send-otp` and `purpose: "change-password"`.
- **403 “Change password is not available for this account type”**: Only Admin, Manager, Staff, and User are supported for change-password with token; ensure the token is for one of these.
