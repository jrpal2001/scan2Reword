# Staff Pump Assignment & Transaction Tracking Flow

**Last Updated:** February 20, 2026

This document explains how staff are connected to pumps and how transactions are tracked by pump.

---

## Overview

**Key Points:**
1. **Staff must be assigned to pumps** before they can create transactions
2. **Every transaction stores `pumpId`** - so admin/manager can always track which pump it happened at
3. **Staff can only create transactions** for pumps they're assigned to
4. **Staff can only view transactions** from their assigned pumps

---

## How Staff Are Connected to Pumps

### StaffAssignment Model

Staff are connected to pumps via the **`StaffAssignment`** model:

```javascript
{
  userId: ObjectId,      // Staff user ID
  pumpId: ObjectId,      // Pump ID
  status: 'active' | 'inactive',
  assignedAt: Date,
  endDate: Date | null
}
```

**Important:**
- One staff can be assigned to **multiple pumps**
- One pump can have **multiple staff** assigned
- Unique constraint: `(userId, pumpId)` - prevents duplicate assignments

---

## Complete Flow

### Step 1: Create Staff

**API:** `POST /api/admin/users` or `POST /api/manager/users`

**Request:**
```json
{
  "fullName": "Priya Staff",
  "mobile": "9876543211",
  "email": "priya@example.com",
  "role": "staff",
  "password": "staff123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "staff-id-456",
      "role": "staff",
      "staffCode": "STF0001"  // Auto-generated
    }
  }
}
```

**Save the staff `_id` for pump assignment.**

---

### Step 2: Assign Staff to Pump

**API:** `POST /api/admin/staff-assignments`

**Headers:**
```
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

**Request:**
```json
{
  "staffId": "staff-id-456",
  "pumpId": "pump-id-789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Staff assigned to pump successfully",
  "data": {
    "_id": "assignment-id-001",
    "userId": "staff-id-456",
    "pumpId": "pump-id-789",
    "status": "active",
    "assignedAt": "2026-02-20T12:00:00.000Z"
  }
}
```

**Important:** Staff can be assigned to **multiple pumps**. Just call this API multiple times with different `pumpId`.

---

### Step 3: Staff Creates Transaction

**API:** `POST /api/transactions`

**Headers:**
```
Authorization: Bearer <staff-access-token>
Content-Type: multipart/form-data
```

**Request Body (form-data):**
```
identifier: "LOY12345678"  // User's loyaltyId from QR scan
pumpId: "pump-id-789"      // ← MUST be a pump staff is assigned to
amount: "1000"
liters: "50"               // Required for Fuel category
category: "Fuel"
billNumber: "BILL001"
paymentMode: "cash"
attachments: (file, optional)
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "_id": "txn-id-001",
    "pumpId": "pump-id-789",  // ← Stored in transaction
    "userId": "user-id-001",
    "operatorId": "staff-id-456",  // ← Staff who created it
    "amount": 1000,
    "liters": 50,
    "pointsEarned": 50,
    "createdAt": "2026-02-20T12:30:00.000Z"
  }
}
```

**How It Works:**
1. Staff scans QR → gets `loyaltyId`
2. Staff enters transaction details including `pumpId`
3. System checks: Is staff assigned to this `pumpId`? (via `attachPumpScope` middleware)
4. If yes → Transaction created with `pumpId` stored
5. If no → **403 Forbidden** error

---

### Step 4: Admin/Manager Views Transactions

**API:** `GET /api/transactions`

**Query Parameters:**
- `pumpId` (optional): Filter by pump
- `page`, `limit`: Pagination
- `startDate`, `endDate`: Date range

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "txn-id-001",
        "pumpId": "pump-id-789",  // ← Shows which pump
        "pump": {                 // ← Populated pump details
          "_id": "pump-id-789",
          "name": "Mumbai Central Pump",
          "code": "MUM001"
        },
        "userId": "user-id-001",
        "operatorId": "staff-id-456",  // ← Shows which staff created it
        "operator": {                  // ← Populated staff details
          "_id": "staff-id-456",
          "fullName": "Priya Staff",
          "staffCode": "STF0001"
        },
        "amount": 1000,
        "pointsEarned": 50,
        "createdAt": "2026-02-20T12:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

**Admin:** Sees **all transactions** from **all pumps**  
**Manager:** Sees transactions only from **their assigned pump(s)**  
**Staff:** Sees transactions only from **pumps they're assigned to**

---

## How Transactions Track Pump

### Transaction Model

Every transaction **always** stores `pumpId`:

```javascript
{
  _id: ObjectId,
  pumpId: ObjectId,        // ← REQUIRED - Always stored
  userId: ObjectId,
  operatorId: ObjectId,   // ← Staff/Manager who created it
  amount: Number,
  liters: Number,
  category: String,
  billNumber: String,
  pointsEarned: Number,
  createdAt: Date
}
```

**Key Fields:**
- **`pumpId`**: Which pump the transaction happened at
- **`operatorId`**: Which staff/manager created the transaction
- **`userId`**: Which customer received the points

---

## Staff Assignment APIs

### 1. Assign Staff to Pump

**Endpoint:** `POST /api/admin/staff-assignments`  
**Access:** Admin only

**Request:**
```json
{
  "staffId": "staff-user-id",
  "pumpId": "pump-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Staff assigned to pump successfully",
  "data": {
    "_id": "assignment-id",
    "userId": "staff-id",
    "pumpId": "pump-id",
    "status": "active",
    "assignedAt": "2026-02-20T12:00:00.000Z"
  }
}
```

---

### 2. List All Assignments

**Endpoint:** `GET /api/admin/staff-assignments`  
**Access:** Admin only

**Query Parameters:**
- `page`, `limit`: Pagination
- `staffId`: Filter by staff
- `pumpId`: Filter by pump
- `status`: Filter by status (`active`, `inactive`)

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "assignment-id",
        "userId": {
          "_id": "staff-id",
          "fullName": "Priya Staff",
          "mobile": "9876543211",
          "staffCode": "STF0001"
        },
        "pumpId": {
          "_id": "pump-id",
          "name": "Mumbai Central Pump",
          "code": "MUM001"
        },
        "status": "active",
        "assignedAt": "2026-02-20T12:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### 3. Get Assignments for a Staff

**Endpoint:** `GET /api/admin/staff-assignments/staff/:staffId`  
**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "assignment-id",
      "pumpId": {
        "_id": "pump-id-789",
        "name": "Mumbai Central Pump",
        "code": "MUM001"
      },
      "status": "active",
      "assignedAt": "2026-02-20T12:00:00.000Z"
    }
  ]
}
```

---

### 4. Get Staff for a Pump

**Endpoint:** `GET /api/admin/staff-assignments/pump/:pumpId`  
**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "assignment-id",
      "userId": {
        "_id": "staff-id-456",
        "fullName": "Priya Staff",
        "mobile": "9876543211",
        "staffCode": "STF0001"
      },
      "status": "active",
      "assignedAt": "2026-02-20T12:00:00.000Z"
    }
  ]
}
```

---

### 5. Remove Staff from Pump

**Endpoint:** `DELETE /api/admin/staff-assignments/:assignmentId`  
**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "message": "Staff removed from pump successfully"
}
```

**Note:** This sets `status: 'inactive'` and `endDate: now()` (soft delete). Staff can be reassigned later.

---

## How Pump Scope Works

### For Staff

When staff logs in and makes requests:

1. **`attachPumpScope` middleware** runs
2. It queries `StaffAssignment` for `userId = staff._id` and `status = 'active'`
3. Gets all `pumpId`s from those assignments
4. Sets `req.allowedPumpIds = [pump-id-1, pump-id-2, ...]`

**When creating transaction:**
- Staff must provide `pumpId` in request body
- System checks: `Is pumpId in req.allowedPumpIds?`
- If yes → Transaction created
- If no → **403 Forbidden**

**When listing transactions:**
- System filters: `WHERE pumpId IN req.allowedPumpIds`
- Staff only sees transactions from their assigned pumps

---

### For Manager

1. **`attachPumpScope` middleware** runs
2. It queries `Pump` for `managerId = manager._id` and `status = 'active'`
3. Gets all `pumpId`s from those pumps
4. Sets `req.allowedPumpIds = [pump-id-1, pump-id-2, ...]`

**Manager sees:**
- Transactions from their assigned pump(s)
- Staff assigned to their pump(s)
- Dashboard stats for their pump(s)

---

### For Admin

- `req.allowedPumpIds = null` (means **all pumps**)
- Admin sees **everything** from **all pumps**

---

## Complete Example Flow

### Scenario: Staff scans QR and creates transaction

#### 1. Admin Assigns Staff to Pump
```
POST /api/admin/staff-assignments
{
  "staffId": "staff-id-456",
  "pumpId": "pump-id-789"
}
→ Staff is now assigned to pump
```

#### 2. Staff Logs In
```
POST /api/auth/login
{
  "identifier": "priya@example.com",
  "password": "staff123"
}
→ Receives accessToken
```

#### 3. Staff Scans QR Code
```
POST /api/scan/validate
{
  "identifier": "LOY12345678"
}
→ Gets user/vehicle info
```

#### 4. Staff Creates Transaction
```
POST /api/transactions
{
  "identifier": "LOY12345678",
  "pumpId": "pump-id-789",  // ← Must be assigned pump
  "amount": 1000,
  "liters": 50,
  "category": "Fuel",
  "billNumber": "BILL001",
  "paymentMode": "cash"
}
→ Transaction created with pumpId stored
```

#### 5. Admin Views Transaction
```
GET /api/transactions?pumpId=pump-id-789
→ Sees transaction with pumpId, operatorId (staff), userId (customer)
```

#### 6. Manager Views Transaction
```
GET /api/transactions
→ Manager only sees transactions from their pump(s)
→ If transaction.pumpId matches manager's pump → visible
→ If not → filtered out
```

---

## Tracking Transactions by Pump

### Admin Dashboard

**API:** `GET /api/admin/dashboard`

Shows aggregated stats **across all pumps**. To see per-pump breakdown:

**API:** `GET /api/transactions?pumpId=pump-id-789`

---

### Manager Dashboard

**API:** `GET /api/manager/dashboard`

Shows stats **only for manager's pump(s)**. Automatically filtered by `req.allowedPumpIds`.

---

### Filter Transactions by Pump

**API:** `GET /api/transactions?pumpId=pump-id-789`

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "txn-id-001",
        "pumpId": "pump-id-789",
        "pump": {
          "name": "Mumbai Central Pump",
          "code": "MUM001"
        },
        "operatorId": "staff-id-456",
        "operator": {
          "fullName": "Priya Staff",
          "staffCode": "STF0001"
        },
        "amount": 1000,
        "pointsEarned": 50,
        "createdAt": "2026-02-20T12:30:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

## Important Notes

1. **Staff MUST be assigned to pump** before creating transactions
2. **Every transaction stores `pumpId`** - always trackable
3. **Staff can only create transactions** for assigned pumps
4. **Staff can only view transactions** from assigned pumps
5. **Manager sees transactions** only from their pump(s)
6. **Admin sees all transactions** from all pumps
7. **One staff can be assigned to multiple pumps**
8. **One pump can have multiple staff**

---

## Summary

| Question | Answer |
|----------|--------|
| **Is staff connected to pump?** | Yes, via `StaffAssignment` model |
| **How to assign staff to pump?** | `POST /api/admin/staff-assignments` |
| **How to track which pump transaction happened at?** | Every transaction has `pumpId` field |
| **Can staff create transaction without pump assignment?** | No, they'll get 403 Forbidden |
| **Can admin see all transactions?** | Yes, admin sees all pumps |
| **Can manager see transactions from other pumps?** | No, only their assigned pump(s) |
| **Can staff see transactions from other pumps?** | No, only their assigned pump(s) |

---

**Last Updated:** February 20, 2026
