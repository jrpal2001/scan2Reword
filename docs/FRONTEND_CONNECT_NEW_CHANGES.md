# Frontend Connection Guide — New/Changed APIs

This file documents **only the new/changed APIs** implemented in the latest changes (search fixes, referred users, staff dashboard totals, admin account controls, etc.).

Base URL examples use:

- `{{baseUrl}}` = your backend base URL (e.g. `http://localhost:5000`)
- Auth header for protected routes:
  - `Authorization: Bearer {{token}}`

---

## 1) Admin — User list search (loyaltyId fix)

### GET `/api/admin/users`

**Auth:** Admin token  
**Query (optional):** `page`, `limit`, `status`, `search`

`search` now correctly matches: `fullName`, `mobile`, `email`, **`loyaltyId`**.

**Example**

```http
GET {{baseUrl}}/api/admin/users?page=1&limit=10&search=LOY123
Authorization: Bearer {{adminToken}}
```

---

## 2) Banners — Manager list shows only own banners

### GET `/api/manager/banners`

**Auth:** Manager token  
**Behavior:** returns **only banners created by this manager**.

**Example**

```http
GET {{baseUrl}}/api/manager/banners?page=1&limit=10
Authorization: Bearer {{managerToken}}
```

---

## 3) Public pumps list — search support

### GET `/api/pumps`

**Auth:** None  
**Query (optional):**
- `lat`, `lng` (optional) → adds `distanceKm` + sorts by distance
- `search` (optional) → matches `name`, `code`, `location.address`, `location.city`, `location.state`

**Example**

```http
GET {{baseUrl}}/api/pumps?search=hp&lat=22.5726&lng=88.3639
```

**Response (shape)**

```json
{
  "success": true,
  "message": "Pumps retrieved",
  "data": {
    "list": [
      {
        "_id": "69a03e0efe9553a49e7adb21",
        "name": "HP Pump",
        "code": "HP001",
        "location": { "address": "...", "city": "...", "state": "...", "lat": 22.57, "lng": 88.36 },
        "status": "active",
        "pumpImages": [],
        "distanceKm": 1.23
      }
    ]
  }
}
```

---

## 4) Referred users list — one API for Admin/Manager/Staff

### GET `/api/users/referred`

**Auth:** Admin or Manager or Staff token

**Query:**
- `referrerId`:
  - **Admin:** required (must be a Manager/Staff MongoDB id)
  - **Manager/Staff:** optional (defaults to self). If you pass another id → 403.
- Pagination: `page`, `limit`
- Filters: `status` (`active|inactive|blocked`), `search`

**Examples**

Admin:

```http
GET {{baseUrl}}/api/users/referred?referrerId={{managerId}}&page=1&limit=10
Authorization: Bearer {{adminToken}}
```

Manager (self):

```http
GET {{baseUrl}}/api/users/referred?page=1&limit=10
Authorization: Bearer {{managerToken}}
```

---

## 5) Manager/Staff — referral summary + points history (pagination)

These APIs show:
- **referred user count**
- **walletSummary** (earned/available/redeemed/expired)
- **ledger history** (credit/debit entries) with pagination

### GET `/api/manager/referrals/summary`
### GET `/api/staff/referrals/summary`

**Auth:** Manager/Staff token

**Example**

```http
GET {{baseUrl}}/api/manager/referrals/summary
Authorization: Bearer {{managerToken}}
```

**Response (shape)**

```json
{
  "success": true,
  "message": "Referral summary retrieved",
  "data": {
    "referredUserCount": 12,
    "walletSummary": {
      "totalEarned": 100,
      "availablePoints": 70,
      "redeemedPoints": 30,
      "expiredPoints": 0
    }
  }
}
```

### GET `/api/manager/referrals/history`
### GET `/api/staff/referrals/history`

**Auth:** Manager/Staff token  
**Query:** `page`, `limit`

**Example**

```http
GET {{baseUrl}}/api/staff/referrals/history?page=1&limit=20
Authorization: Bearer {{staffToken}}
```

**Response (shape)**

```json
{
  "success": true,
  "message": "Referral history retrieved",
  "data": {
    "walletSummary": { "totalEarned": 100, "availablePoints": 70, "redeemedPoints": 30, "expiredPoints": 0 },
    "ledger": [
      {
        "_id": "....",
        "userId": "....",
        "ownerType": "Staff",
        "type": "credit",
        "points": 10,
        "balanceAfter": 10,
        "reason": "Referral bonus - User ... registered with referral code",
        "createdAt": "2026-03-10T10:00:00.000Z",
        "createdAtIST": "2026-03-10T15:30:00+05:30"
      }
    ]
  },
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

## 6) Staff dashboard — added today/weekly/monthly totals (my transactions)

### GET `/api/staff/dashboard`

**Auth:** Staff token  
**Behavior:** response now includes `myTotals`:
- `today.fuelLiters`, `today.amount`, `today.points`
- `thisWeek.fuelLiters`, `thisWeek.amount`, `thisWeek.points`
- `thisMonth.fuelLiters`, `thisMonth.amount`, `thisMonth.points`

These totals are based on transactions where **`operatorId = staffId`**.

**Example**

```http
GET {{baseUrl}}/api/staff/dashboard
Authorization: Bearer {{staffToken}}
```

---

## 7) Admin — block/unblock user/manager/staff

### PATCH `/api/admin/accounts/:id/status?type=user|manager|staff`

**Auth:** Admin token  
**Body (JSON):**

```json
{ "status": "blocked", "reason": "optional" }
```

**Example**

```http
PATCH {{baseUrl}}/api/admin/accounts/69a03a74fe9553a49e7adb08/status?type=manager
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{ "status": "blocked", "reason": "Fraud" }
```

---

## 8) Admin — delete manager/staff account

### DELETE `/api/admin/managers/:managerId`
### DELETE `/api/admin/staff/:staffId`

**Auth:** Admin token  
**Note:** Transactions are not deleted.

---

## 9) Admin — update manager/staff by id (extended fields)

### PATCH `/api/admin/managers/:managerId`
### PATCH `/api/admin/staff/:staffId`

**Auth:** Admin token  
**Body (JSON):** supports `fullName`, `mobile`, `email`, `address`, `profilePhoto`,`password`, and codes/referral fields.

---

## 10) Admin — redeem manager/staff referral points

### POST `/api/admin/referrals/redeem`

**Auth:** Admin token  
**Body (JSON):**

```json
{
  "ownerId": "69a03a74fe9553a49e7adb08",
  "ownerType": "Manager",
  "points": 10,
  "reason": "Redeemed in cash"
}
```

This debits points from the manager/staff wallet and creates a PointsLedger entry with `ownerType = Manager|Staff`.

---

## 11) Profile update (already exists)

- **User:** `PATCH /api/user/profile`
- **Manager:** `PATCH /api/manager/profile`
- **Staff:** `PATCH /api/staff/profile`

All accept: `fullName`, `email`, `address`, `profilePhoto` (multipart upload supported via `profilePhoto` file field).

