# Fleet Owner / Fleet Driver & Registration API Bodies

## Differentiating Fleet Owner vs Fleet Driver

Every **User (customer)** document has:

| Field     | Fleet Owner        | Fleet Driver        | Individual (no fleet) |
|----------|--------------------|---------------------|------------------------|
| **userType** | `"owner"`          | `"driver"`          | `"individual"`         |
| **ownerId**  | `null`             | `<owner's _id>`     | `null`                 |
| **loyaltyId**| Present (LOY…)     | Usually none*       | None*                  |

- **userType** is stored on the User schema and is the single source of truth for **isFleetOwner** / **isFleetDriver** in APIs.
- **ownerId** links a driver to their fleet owner; fleet owners have **ownerId: null**.

In **verify-otp** and other auth/user responses you get:
- **user.userType**: `"individual"` | `"owner"` | `"driver"`
- **isFleetOwner**: `true` when `userType === 'owner'`
- **isFleetDriver**: `true` when `userType === 'driver'`

---

## 1. POST {{baseUrl}}/api/auth/register

### 1a. Fleet owner only (no driver, no vehicle)

Creates only the fleet owner. Use when you will add drivers/vehicles later.

**Body (JSON or form-data):**

```json
{
  "accountType": "organization",
  "ownerOnly": true,
  "ownerType": "non-registered",
  "owner": {
    "fullName": "Fleet Owner",
    "mobile": "9090181814",
    "email": "owner@fleet.com",
    "address": {
      "street": "123",
      "city": "bbsr",
      "state": "odisha",
      "pincode": "752069"
    }
  },
  "registeredPumpCode": "PMP002"
}
```

Optional form-data file: **ownerPhoto**.

**Response:** `userId` (owner), `loyaltyId`, `user` (with `userType: "owner"`, `ownerId: null`). No vehicle/driver.

---

### 1b. Fleet owner + driver + vehicle (one request)

Creates the owner, then the driver, then one vehicle for the driver.

**Body (JSON or form-data):**

```json
{
  "accountType": "organization",
  "ownerType": "non-registered",
  "owner": {
    "fullName": "Fleet Owner",
    "mobile": "9090181814",
    "email": "owner@fleet.com",
    "address": { "street": "123", "city": "bbsr", "state": "odisha", "pincode": "752069" }
  },
  "mobile": "9090181813",
  "fullName": "Fleet Driver",
  "email": "driver@fleet.com",
  "address": { "street": "123 Main St", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001" },
  "vehicle": {
    "vehicleNumber": "OD01EF9012",
    "vehicleType": "Commercial",
    "fuelType": "Diesel"
  },
  "registeredPumpCode": "PMP002"
}
```

For **form-data**, you can send **vehicle** as a single string:  
`vehicle: {"vehicleNumber":"OD01EF9012","vehicleType":"Commercial","fuelType":"Diesel"}`  
or send flat: **vehicleNumber**, **vehicleType**, **fuelType**.

Optional files: **profilePhoto**, **driverPhoto**, **ownerPhoto**, **rcPhoto**, etc.

**Response:** `userId` (driver), `vehicleId`, `loyaltyId` (vehicle), `ownerId` (owner’s _id). Owner has `userType: "owner"`, driver has `userType: "driver"`.

---

### 1c. Driver only (owner already exists)

Adds a driver (and optionally a vehicle) under an existing fleet owner. Owner is identified by **ownerIdentifier** (owner’s mobile or _id).

**Body:**

```json
{
  "accountType": "organization",
  "ownerType": "registered",
  "ownerIdentifier": "9090181814",
  "mobile": "9090181815",
  "fullName": "Second Driver",
  "email": "driver2@fleet.com",
  "vehicle": {
    "vehicleNumber": "MH12AB1234",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  },
  "registeredPumpCode": "PMP002"
}
```

**Response:** New driver user (with `userType: "driver"`, `ownerId: <owner _id>`), vehicle if provided.

---

## 2. POST {{baseUrl}}/api/admin/users

Admin creates users (role: **user** | manager | staff). For **role: user** the same three fleet cases apply.

### 2a. Fleet owner only

**Body (e.g. form-data):**

- **role**: `user`
- **accountType**: `organization`
- **ownerOnly**: `true`
- **ownerType**: `non-registered`
- **owner**: `{"fullName":"Fleet Owner","mobile":"9090181814","email":"owner@fleet.com","address":{...}}`
- **registeredPumpId** or **registeredPumpCode** (optional)

Optional file: **ownerPhoto**.

---

### 2b. Fleet owner + driver + vehicle

**Body:**

- **role**: `user`
- **accountType**: `organization`
- **ownerType**: `non-registered`
- **owner**: `{"fullName":"Fleet Owner","mobile":"9090181814",...}`
- **mobile**, **fullName**, **email**, **address** (driver)
- **vehicle**: object or JSON string, or **vehicleNumber** + **vehicleType** + **fuelType**
- **registeredPumpCode** (optional)

Optional files: **profilePhoto**, **driverPhoto**, **ownerPhoto**, **rcPhoto**, etc.

---

### 2c. Driver under existing owner

**Body:**

- **role**: `user`
- **accountType**: `organization`
- **ownerType**: `registered`
- **ownerIdentifier**: owner’s mobile or Mongo _id (e.g. `9090181814` or `699d3f0ea0488874a98c4d0a`)
- **mobile**, **fullName**, **email**, **address**
- **vehicle**: object or JSON string or flat fields
- **registeredPumpCode** (optional)

---

## 3. POST {{baseUrl}}/api/manager/users

Same body shape as **admin/users** for fleet flows. Manager can create **role: user** (individual or organization) or **role: staff**.

- **Fleet owner only:** same as 2a (ownerOnly, ownerType: non-registered, owner).
- **Fleet owner + driver + vehicle:** same as 2b.
- **Driver under existing owner:** same as 2c (ownerType: registered, ownerIdentifier).

Manager is pump-scoped; pump context is attached by the route.

---

## 4. POST {{baseUrl}}/api/staff/users

Staff can create only **role: user** (no staff). Same three fleet bodies as above for **accountType: organization** (owner only, owner+driver+vehicle, driver with existing owner).

---

## Verify-OTP and userType / isFleetOwner / isFleetDriver

After **POST /api/auth/verify-otp** (login by OTP), the response includes:

- **user.userType**: `"individual"` | `"owner"` | `"driver"`
- **user.ownerId**: `null` for owner/individual, or owner’s _id for driver
- **isFleetOwner**: boolean (`userType === 'owner'`)
- **isFleetDriver**: boolean (`userType === 'driver'`)
- **isIndividualUser**: boolean (`userType === 'individual'`)

So you can differentiate fleet owner vs fleet driver in the app using **userType** (and optionally **ownerId**). Ensure every created owner has **userType: "owner"** and every driver has **userType: "driver"**; the backend sets these on create. If old documents in MongoDB don’t have **userType**, you can backfill: set `userType: "owner"` where `ownerId === null` and loyaltyId exists, and `userType: "driver"` where `ownerId` is set.
