# User Registration Flow & Postman Test Guide

**Base URL:** `http://localhost:3000` (or your server URL)

---

## 1. Normal User Registration Flow

### Step 1: Ask user type (Individual vs Organization)

Frontend asks: **Individual** or **Organization (Fleet)**?

- **Individual** → One person, one vehicle. Send `accountType: "individual"` and user + vehicle details.
- **Organization** → Fleet owner + driver(s). Next step: is the **owner already registered**?

### Step 2 (Organization only): Search for existing owner (public API)

**Endpoint:** `GET /api/owner/search?identifier=<value>`  
**Auth:** None (public) – admin, staff, manager, or end-user can call without token.

**identifier** can be:
- Owner’s **MongoDB _id**
- Owner’s **phone number** (mobile)
- Owner’s **email**

**Example:**
```http
GET http://localhost:3000/api/owner/search?identifier=9876543210
GET http://localhost:3000/api/owner/search?identifier=owner@company.com
GET http://localhost:3000/api/owner/search?identifier=507f1f77bcf86cd799439011
```

**Response (200):**
```json
{
  "success": true,
  "message": "Owner found",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "Fleet Owner",
    "mobile": "9876543210",
    "email": "owner@company.com",
    "address": { "street": "", "city": "", "state": "", "pincode": "" }
  }
}
```

**Response (404):** Owner not found → use **non-registered** flow and create owner + driver in one call.

### Step 3: Register

- **If Individual:** Send `accountType: "individual"` + user + vehicle. One user + one vehicle created.
- **If Organization + owner found:** Send `accountType: "organization"`, `ownerType: "registered"`, `ownerIdentifier: "<owner _id or phone or email>"` + **driver** details (mobile, fullName, vehicle). One user (driver) linked to existing owner.
- **If Organization + owner not found:** Send `accountType: "organization"`, `ownerType: "non-registered"`, `owner: { fullName, mobile, email?, address? }` + **driver** details (mobile, fullName, vehicle). **Two users** created (owner + driver) in one API call.

---

## 2. Postman Request Bodies

Replace `{{baseUrl}}` with `http://localhost:3000` or your API URL. Get admin/manager/staff tokens via `POST /api/auth/login` first.

---

### A. Auth APIs (Public)

#### 1) Send OTP
```http
POST {{baseUrl}}/api/auth/send-otp
Content-Type: application/json
```
```json
{
  "mobile": "9876543210",
  "purpose": "register"
}
```

#### 2) Verify OTP (login/register)
```http
POST {{baseUrl}}/api/auth/verify-otp
Content-Type: application/json
```
```json
{
  "mobile": "9876543210",
  "otp": "123456",
  "purpose": "register"
}
```

#### 3) Register – Individual
```http
POST {{baseUrl}}/api/auth/register
Content-Type: application/json
```
```json
{
  "accountType": "individual",
  "mobile": "9876543210",
  "fullName": "John Driver",
  "email": "john@example.com",
  "vehicle": {
    "vehicleNumber": "MH12AB1234",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

#### 4) Register – Organization (registered owner – use owner ID/phone/email from search)
```http
POST {{baseUrl}}/api/auth/register
Content-Type: application/json
```
```json
{
  "accountType": "organization",
  "ownerType": "registered",
  "ownerIdentifier": "9876543210",
  "mobile": "9999888877",
  "fullName": "Driver One",
  "email": "driver1@example.com",
  "vehicle": {
    "vehicleNumber": "MH14CD5678",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Diesel"
  }
}
```

#### 5) Register – Organization (non-registered owner – creates owner + driver)
```http
POST {{baseUrl}}/api/auth/register
Content-Type: application/json
```
```json
{
  "accountType": "organization",
  "ownerType": "non-registered",
  "owner": {
    "fullName": "Fleet Owner",
    "mobile": "9111222333",
    "email": "owner@fleet.com"
  },
  "mobile": "9444555666",
  "fullName": "Fleet Driver",
  "email": "driver@fleet.com",
  "vehicle": {
    "vehicleNumber": "MH01EF9012",
    "vehicleType": "Commercial",
    "fuelType": "Diesel"
  }
}
```

#### 6) Login (admin/manager/staff)
```http
POST {{baseUrl}}/api/auth/login
Content-Type: application/json
```
```json
{
  "identifier": "admin@gmail.com",
  "password": "admin123"
}
```
Use `accessToken` from response in header: `Authorization: Bearer <accessToken>`.

---

### B. Owner API (Public for search)

#### 7) Search owner (public – no auth)
```http
GET {{baseUrl}}/api/owner/search?identifier=9876543210
```
Or use owner `_id` or email as `identifier`.

---

### C. Admin APIs

**Header:** `Authorization: Bearer <admin-accessToken>`

#### 8) Create manager
**API:** `POST {{baseUrl}}/api/admin/users`  
**Header:** `Authorization: Bearer <admin-accessToken>`  
**Body:** JSON or form-data (form-data if sending profilePhoto).

**All allowed fields for Manager:**

| Field        | Type   | Required | Description |
|-------------|--------|----------|-------------|
| fullName    | string | Yes      | 2–100 chars |
| mobile      | string | Yes      | 10-digit Indian (6–9 start) |
| email       | string | No       | Valid email, lowercased |
| role        | string | Yes      | Must be `"manager"` |
| password    | string | Yes      | Min 6 chars (for manager/staff) |
| address     | object | No       | `{ street?, city?, state?, pincode? }` |
| managerCode | string | No       | Auto-generated (e.g. MGR0001) if omitted |
| profilePhoto| file   | No       | Send via form-data key `profilePhoto` |

**Example (JSON):**
```json
{
  "fullName": "Rajesh Manager",
  "mobile": "9777777777",
  "email": "rajesh@example.com",
  "role": "manager",
  "password": "manager123",
  "address": {
    "street": "Main Rd",
    "city": "Mumbai",
    "state": "MH",
    "pincode": "400001"
  }
}
```
*Optional: `managerCode` (e.g. `"MGR0001"`) — if not sent, a unique code is auto-generated. Referral code is auto-generated.*

#### 9) Create staff
**API:** `POST {{baseUrl}}/api/admin/users`  
**Header:** `Authorization: Bearer <admin-accessToken>`  
**Body:** JSON or form-data (form-data if sending profilePhoto).

**All allowed fields for Staff:**

| Field             | Type   | Required | Description |
|-------------------|--------|----------|-------------|
| fullName          | string | Yes      | 2–100 chars |
| mobile            | string | Yes      | 10-digit Indian (6–9 start) |
| email             | string | No       | Valid email, lowercased |
| role              | string | Yes      | Must be `"staff"` |
| password          | string | Yes      | Min 6 chars (for manager/staff) |
| address           | object | No       | `{ street?, city?, state?, pincode? }` |
| staffCode         | string | No       | Auto-generated (e.g. STF0001) if omitted |
| assignedManagerId | string | No       | Manager’s MongoDB _id (24-char hex) |
| pumpId            | string | No       | Pump’s _id to assign staff to this pump at creation |
| profilePhoto      | file   | No       | Send via form-data key `profilePhoto` |

**Example (JSON):**
```json
{
  "fullName": "Priya Staff",
  "mobile": "9666666666",
  "email": "priya@example.com",
  "role": "staff",
  "password": "staff123",
  "assignedManagerId": "<manager-_id>",
  "pumpId": "<pump-_id>",
  "address": {
    "street": "Pump Lane",
    "city": "Pune",
    "state": "MH",
    "pincode": "411001"
  }
}
```
*Optional: `staffCode` — auto-generated if omitted. Referral code is auto-generated. If `pumpId` is provided, staff is assigned to that pump on creation.*

#### 9a) Assign staff to a manager and/or pump

**Assign staff to a manager (set who manages this staff):**  
**API:** `PATCH {{baseUrl}}/api/admin/users/:userId?type=staff`  
**Header:** `Authorization: Bearer <admin-accessToken>`  
**Params:** `userId` = staff’s MongoDB `_id`.  
**Query:** `type=staff` (required so the endpoint updates the Staff record).  
**Body (JSON):**
```json
{
  "assignedManagerId": "<manager-_id>"
}
```
Optional: `fullName`, `email`, `address` can be included in the same body.

**Assign staff to a pump (which pump they work at):**  
**API:** `POST {{baseUrl}}/api/admin/staff-assignments`  
**Header:** `Authorization: Bearer <admin-accessToken>`  
**Body (JSON):**
```json
{
  "staffId": "<staff-_id>",
  "pumpId": "<pump-_id>"
}
```
This creates a staff–pump assignment. To remove, use `DELETE /api/admin/staff-assignments/:assignmentId`. To list assignments: `GET /api/admin/staff-assignments`.

**Summary:** Use **PATCH** with `?type=staff` to set a staff’s **manager**; use **POST** staff-assignments to assign the staff to a **pump**.

#### 10) Admin – Create individual user
```http
POST {{baseUrl}}/api/admin/users
Content-Type: application/json
```
```json
{
  "fullName": "Individual User",
  "mobile": "9555555555",
  "email": "user@example.com",
  "role": "user",
  "vehicle": {
    "vehicleNumber": "MH02GH3456",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

#### 11) Admin – Create organization user (registered owner)
```http
POST {{baseUrl}}/api/admin/users
Content-Type: application/json
```
```json
{
  "accountType": "organization",
  "ownerType": "registered",
  "ownerIdentifier": "9876543210",
  "fullName": "New Driver",
  "mobile": "9333333333",
  "email": "newdriver@example.com",
  "role": "user",
  "vehicle": {
    "vehicleNumber": "MH03IJ7890",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

#### 12) Admin – Create organization user (non-registered owner)
```http
POST {{baseUrl}}/api/admin/users
Content-Type: application/json
```
```json
{
  "accountType": "organization",
  "ownerType": "non-registered",
  "owner": {
    "fullName": "New Owner",
    "mobile": "9222222222",
    "email": "newowner@example.com"
  },
  "fullName": "New Driver",
  "mobile": "9111111111",
  "email": "newdriver2@example.com",
  "role": "user",
  "vehicle": {
    "vehicleNumber": "MH04KL1111",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

---

### D. Manager APIs

**Header:** `Authorization: Bearer <manager-accessToken>`

#### 13) Manager – Create user (individual)
```http
POST {{baseUrl}}/api/manager/users
Content-Type: application/json
```
```json
{
  "fullName": "Manager Created User",
  "mobile": "9000000001",
  "email": "muser@example.com",
  "role": "user",
  "vehicle": {
    "vehicleNumber": "MH05MN2222",
    "vehicleType": "Two-Wheeler",
    "fuelType": "Petrol"
  }
}
```

#### 14) Manager – Create staff
```http
POST {{baseUrl}}/api/manager/users
Content-Type: application/json
```
```json
{
  "fullName": "Staff By Manager",
  "mobile": "9000000002",
  "email": "staffbymanager@example.com",
  "role": "staff",
  "password": "staff123"
}
```
Staff is auto-assigned to manager’s pump if `pumpId` not provided.

#### 15) Manager – Create organization user (registered owner)
```http
POST {{baseUrl}}/api/manager/users
Content-Type: application/json
```
```json
{
  "accountType": "organization",
  "ownerType": "registered",
  "ownerIdentifier": "9876543210",
  "fullName": "Driver By Manager",
  "mobile": "9000000003",
  "role": "user",
  "vehicle": {
    "vehicleNumber": "MH06OP3333",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Diesel"
  }
}
```

---

### E. Staff APIs

**Header:** `Authorization: Bearer <staff-accessToken>`

#### 16) Staff – Create user (individual)
```http
POST {{baseUrl}}/api/staff/users
Content-Type: application/json
```
```json
{
  "fullName": "Staff Created User",
  "mobile": "9000000004",
  "email": "staffuser@example.com",
  "role": "user",
  "vehicle": {
    "vehicleNumber": "MH07QR4444",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

#### 17) Staff – Create organization user (registered owner)
```http
POST {{baseUrl}}/api/staff/users
Content-Type: application/json
```
```json
{
  "accountType": "organization",
  "ownerType": "registered",
  "ownerIdentifier": "9876543210",
  "fullName": "Driver By Staff",
  "mobile": "9000000005",
  "role": "user",
  "vehicle": {
    "vehicleNumber": "MH08ST5555",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

---

### F. User APIs (authenticated as user)

**Header:** `Authorization: Bearer <user-accessToken>`

#### 18) Get my vehicles
```http
GET {{baseUrl}}/api/user/vehicles
```

#### 19) Get my profile
```http
GET {{baseUrl}}/api/user/me
```

---

## 3. Summary: Registration flow

| Step | Action | API |
|------|--------|-----|
| 1 | User chooses Individual or Organization | (Frontend) |
| 2 | If Organization: search owner by ID / phone / email | `GET /api/owner/search?identifier=...` (public) |
| 3a | If owner found: register driver and link to owner | `POST /api/auth/register` with `ownerType: "registered"`, `ownerIdentifier: "<id/phone/email>"` |
| 3b | If owner not found: register owner + driver in one call | `POST /api/auth/register` with `ownerType: "non-registered"`, `owner: { ... }` |
| 3c | If Individual: register one user + vehicle | `POST /api/auth/register` with `accountType: "individual"` |

**Search API:** `GET /api/owner/search?identifier=<owner _id | phone | email>` – **public**, no auth. Use it before organization registration to decide between registered vs non-registered.

---

## 4. File upload (form-data)

For **register** or **admin/manager/staff create user** with photos, use **form-data** in Postman:

- **Body** → **form-data**
- Add all text fields as above (e.g. `accountType`, `mobile`, `fullName`, `vehicle` as JSON string).
- Add **file** fields by choosing **File** in the type dropdown and selecting an image (JPEG/PNG) or PDF.

### Image keys for `POST /api/admin/users` (and register / manager / staff create user)

| Form-data key    | Type   | Where it goes                    |
|------------------|--------|-----------------------------------|
| **profilePhoto** | 1 file | User/Manager/Staff profile photo  |
| **driverPhoto**  | 1 file | Driver (user) photo               |
| **ownerPhoto**   | 1 file | Fleet owner photo (organization)  |
| **rcPhoto**      | 1 file | Vehicle RC document               |
| **insurancePhoto** | 1 file | Vehicle insurance                 |
| **fitnessPhoto** | 1 file | Vehicle fitness                   |
| **pollutionPhoto** | 1 file | Vehicle pollution                 |
| **vehiclePhoto** | 1–5 files | Vehicle image(s)                |

**Example in Postman:** For `POST {{baseUrl}}/api/admin/users` with organization + vehicle + images:

- Text: `accountType`, `ownerType`, `owner`, `mobile`, `fullName`, `email`, `vehicle`, `role`, `address`, (optional) `referralCode`, etc.
- File: `profilePhoto` (driver’s profile), `ownerPhoto` (owner’s photo), `rcPhoto` (vehicle RC image). Optionally add `driverPhoto`, `insurancePhoto`, `fitnessPhoto`, `pollutionPhoto`, `vehiclePhoto`.

Allowed file types: **JPEG, PNG, PDF**. Max 50MB per file.

For nested objects send as JSON strings, e.g.  
`vehicle` = `{"vehicleNumber":"MH12AB1234","vehicleType":"Four-Wheeler","fuelType":"Petrol"}`.

---

## 5. Where owners are created & owner loyalty ID

### How an owner (fleet owner) is created

An **owner** is a User document with `ownerId: null` and **`userType: "owner"`**. They are created in **organization** flows when the owner is **not already registered** (`ownerType: "non-registered"`).

| Who creates | API | When owner is created |
|-------------|-----|------------------------|
| **Admin** | `POST /api/admin/users` | Body: `accountType: "organization"`, `ownerType: "non-registered"`, `owner: { fullName, mobile, email?, address? }` + driver + vehicle. Creates owner + driver + vehicle in one call. |
| **User (self)** | `POST /api/auth/register` | Body: `accountType: "organization"`, `ownerType: "non-registered"`, `owner: { ... }` + driver + vehicle. Creates owner + driver + vehicle in one call. |
| **Manager** | `POST /api/manager/users` | Same body as admin (organization + non-registered owner). Creates owner + driver + vehicle. |
| **Staff** | `POST /api/staff/users` | Same body (organization + non-registered owner). Creates owner + driver + vehicle. |

**Owner only (no driver, no vehicle):** Add **`ownerOnly: true`** to the same bodies and omit `vehicle`. Creates only the fleet owner (with `loyaltyId`). Supported in all four APIs above.

If the owner **is already registered** (`ownerType: "registered"`, `ownerIdentifier: "<id|phone|email>"`), no new owner is created; the driver is linked to the existing owner.

### User types (User model)

- **`individual`** – Single user (no fleet).
- **`owner`** – Fleet owner (has `loyaltyId`).
- **`driver`** – Fleet driver (has `ownerId`).

See **PROJECT_UPDATES.md** for points (no expiry), redemption (admin direct vs approval), wallet (driver vs owner visibility), and multiple pumps.

### Owner loyalty ID (fleet QR when vehicle QR is not working)

Each **fleet owner** gets a unique **owner loyalty ID** (same format as vehicle: `LOY` + 8 digits) when they are created. It is stored on the owner’s User document as `loyaltyId`.

- **Use case:** When a fleet vehicle’s QR/loyalty ID is not working, the fleet can use the **owner’s loyalty ID** at the pump. The staff scans the owner’s loyalty ID; the transaction is credited to the **owner’s** account (points go to the owner’s wallet).
- **Where it’s set:** Automatically when creating a new owner in any of the four flows above (admin, register, manager, staff).
- **How to use it:** In **create transaction**, pass `identifier: <owner loyaltyId>` (e.g. `LOY12345678`) instead of a vehicle loyaltyId. The scan service resolves it to the owner and credits the owner.
- **How to get it:** `GET /api/owner/search?identifier=<owner _id | phone | email>` returns the owner including `loyaltyId` (for owners created with this feature; older owners may have `loyaltyId: null` until backfilled).
