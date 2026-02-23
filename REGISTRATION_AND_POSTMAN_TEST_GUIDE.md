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
```http
POST {{baseUrl}}/api/admin/users
Content-Type: application/json
```
```json
{
  "fullName": "Rajesh Manager",
  "mobile": "9777777777",
  "email": "rajesh@example.com",
  "role": "manager",
  "password": "manager123"
}
```

#### 9) Create staff
```http
POST {{baseUrl}}/api/admin/users
Content-Type: application/json
```
```json
{
  "fullName": "Priya Staff",
  "mobile": "9666666666",
  "email": "priya@example.com",
  "role": "staff",
  "password": "staff123",
  "assignedManagerId": "<manager-_id>",
  "pumpId": "<pump-_id>"
}
```

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
- Add fields as above (e.g. `accountType`, `mobile`, `fullName`, `vehicle` as JSON string or separate keys).
- Add file keys: `profilePhoto`, `driverPhoto`, `ownerPhoto`, `rcPhoto` (each one file).

For nested objects (e.g. `vehicle`, `owner`, `address`) you can send as a single key with value as JSON string, e.g.  
`vehicle` = `{"vehicleNumber":"MH12AB1234","vehicleType":"Four-Wheeler","fuelType":"Petrol"}`.
