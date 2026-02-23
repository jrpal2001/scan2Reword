# Complete System Flow with APIs - Scan2Reward

**Last Updated:** February 23, 2026  
**Base URL:** `http://localhost:3000` (or your server URL)

This document explains the complete flow of how the Scan2Reward loyalty system works, including all API calls at each step.

---

## Table of Contents

1. [Admin Setup Flow](#1-admin-setup-flow)
2. [User Registration Flow](#2-user-registration-flow)
3. [Manager/Staff Creation Flow](#3-managerstaff-creation-flow)
4. [Pump Management Flow](#4-pump-management-flow)
5. [Transaction Flow (Points Earning)](#5-transaction-flow-points-earning)
6. [Redemption Flow](#6-redemption-flow)
7. [Points Expiry Flow](#7-points-expiry-flow)
8. [Campaign Flow](#8-campaign-flow)
9. [Dashboard Flow](#9-dashboard-flow)
10. [Owner/Fleet Management Flow](#10-ownerfleet-management-flow)

---

## 1. Admin Setup Flow

### Step 1.1: Admin Login

**API:** `POST /api/auth/login` (or legacy `POST /api/admin/login`)

**Request:**
```json
{
  "email": "admin@gmail.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "admin-id",
      "email": "admin@gmail.com",
      "userType": "Admin"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
}
```

**Save the `accessToken` for subsequent API calls.**

---

### Step 1.2: Get System Configuration

**API:** `GET /api/admin/config`

**Headers:**
```
Authorization: Bearer <admin-access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "points": {
      "fuel": 1,           // 1 point per liter
      "other": 5,          // 5 points per ₹100
      "registration": 50,   // Points for registration
      "referral": 100      // Points for referral
    },
    "pointsExpiry": {
      "durationMonths": 12,
      "notificationDays": [30, 7, 1]
    }
  }
}
```

**Note:** You can update these values using `PATCH /api/admin/config` if needed.

---

### Step 1.3: Create Manager

**API:** `POST /api/admin/users`

**Headers:**
```
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

**Request:**
```json
{
  "fullName": "Rajesh Manager",
  "mobile": "9876543210",
  "email": "rajesh@example.com",
  "role": "manager",
  "password": "manager123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "_id": "manager-id-123",
      "fullName": "Rajesh Manager",
      "mobile": "9876543210",
      "role": "manager",
      "referralCode": "REF12345678"  // Auto-generated
    }
  }
}
```

**Save the manager `_id` for pump assignment.**

---

### Step 1.4: Create Staff (Optional)

**API:** `POST /api/admin/users`

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
      "referralCode": "REF12345679"
    }
  }
}
```

---

### Step 1.5: Create Pump

**API:** `POST /api/admin/pumps`

**Request:**
```json
{
  "name": "Mumbai Central Pump",
  "code": "MUM001",
  "managerId": "manager-id-123",  // From Step 1.3
  "location": {
    "address": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "lat": 19.0760,
    "lng": 72.8777
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "pump-id-789",
    "name": "Mumbai Central Pump",
    "code": "MUM001",
    "managerId": "manager-id-123",
    "status": "active"
  }
}
```

**Note:** `managerId` can be empty (`""`) or `null` if you want to assign later.

---

## 2. User Registration Flow

### Step 2.1: Send OTP

**API:** `POST /api/auth/send-otp`

**Request:**
```json
{
  "mobile": "9876543212"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobile": "9876543212",
    "expiresAt": "2026-02-19T18:40:00.000Z"
  }
}
```

**OTP is sent via SMS. User receives OTP on their mobile.**

---

### Step 2.2: Verify OTP & Register

**API:** `POST /api/auth/register`

**Headers:**
```
Content-Type: multipart/form-data
```

**Request Body (form-data):**
```
fullName: "John Doe"
mobile: "9876543212"
email: "john@example.com"
accountType: "individual"  // or "organization"
vehicleNumber: "MH12AB1234"
vehicleType: "Four-Wheeler"
fuelType: "Petrol"
referralCode: "REF12345678"  // Optional: manager/staff referral code
profilePhoto: (file, optional)
driverPhoto: (file, optional)
rcPhoto: (file, optional)
```

**For Organization (Fleet) Registration:**
```
accountType: "organization"
ownerType: "registered"  // or "non-registered"
ownerId: "owner-id-123"  // If registered owner
// OR for non-registered:
ownerName: "Owner Name"
ownerMobile: "9876543213"
ownerEmail: "owner@example.com"
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "user-id-001",
      "fullName": "John Doe",
      "mobile": "9876543212",
      "role": "user"
    },
    "vehicle": {
      "_id": "vehicle-id-001",
      "vehicleNumber": "MH12AB1234",
      "loyaltyId": "LOY12345678"  // Unique loyalty ID
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

**Important:**
- User gets `loyaltyId` (LOY12345678) - this is used for QR code scanning
- If referral code provided, referrer (manager/staff) gets referral points
- Registration points are NOT credited here (only when manager/staff creates user)

---

### Step 2.3: User Login (Future Sessions)

**API:** `POST /api/auth/send-otp` → `POST /api/auth/verify-otp`

**Flow:**
1. Send OTP: `POST /api/auth/send-otp` with mobile
2. Verify OTP: `POST /api/auth/verify-otp` with mobile + OTP
3. Receive accessToken and refreshToken

---

## 3. Manager/Staff Creation Flow

### Step 3.1: Manager Creates Staff

**API:** `POST /api/manager/users`

**Headers:**
```
Authorization: Bearer <manager-access-token>
Content-Type: application/json
```

**Request:**
```json
{
  "fullName": "New Staff Member",
  "mobile": "9876543214",
  "email": "staff@example.com",
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
      "_id": "staff-id-789",
      "role": "staff",
      "referralCode": "REF12345680"  // Auto-generated
    }
  }
}
```

**Important:**
- Manager gets registration points (from SystemConfig)
- Staff gets auto-generated referral code
- Staff needs to be assigned to pump separately (if needed)

---

### Step 3.2: Manager Creates User (Customer)

**API:** `POST /api/manager/users`

**Request:**
```json
{
  "fullName": "Customer Name",
  "mobile": "9876543215",
  "email": "customer@example.com",
  "role": "user",  // or omit (defaults to user)
  "vehicle": {
    "vehicleNumber": "MH12AB5678",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-id-002",
      "role": "user"
    },
    "vehicle": {
      "loyaltyId": "LOY12345679"
    }
  }
}
```

**Important:**
- Manager gets registration points
- User gets loyaltyId for QR code

---

## 4. Pump Management Flow

### Step 4.1: List All Pumps

**API:** `GET /api/admin/pumps`

**Headers:**
```
Authorization: Bearer <admin-access-token>
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status
- `managerId` (optional): Filter by manager

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "pump-id-789",
        "name": "Mumbai Central Pump",
        "code": "MUM001",
        "managerId": "manager-id-123",
        "status": "active"
      }
    ],
    "total": 1
  }
}
```

---

### Step 4.2: Assign Manager to Pump

**API:** `PATCH /api/admin/pumps/:pumpId`

**Request:**
```json
{
  "managerId": "manager-id-123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pump updated successfully",
  "data": {
    "_id": "pump-id-789",
    "managerId": "manager-id-123"
  }
}
```

---

### Step 4.3: Remove Manager from Pump

**API:** `PATCH /api/admin/pumps/:pumpId`

**Request:**
```json
{
  "managerId": ""  // Empty string removes manager
}
```

---

## 5. Transaction Flow (Points Earning)

### Step 5.1: User Visits Pump

User arrives at pump and makes a purchase (fuel or other items).

---

### Step 5.2: Staff/Manager Scans QR Code

**API:** `POST /api/scan/validate`

**Request:**
```json
{
  "identifier": "LOY12345678"  // User's loyaltyId from QR code
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-id-001",
      "fullName": "John Doe",
      "mobile": "9876543212"
    },
    "vehicle": {
      "vehicleNumber": "MH12AB1234",
      "loyaltyId": "LOY12345678"
    },
    "isOwner": false
  }
}
```

**Staff confirms user identity.**

---

### Step 5.3: Create Transaction (Points Earned)

**API:** `POST /api/transactions`

**Headers:**
```
Authorization: Bearer <manager-or-staff-access-token>
Content-Type: multipart/form-data
Idempotency-Key: unique-key-123  // Optional: prevent duplicate requests
```

**Request Body (form-data):**
```
identifier: "LOY12345678"  // or mobile or owner-id
pumpId: "pump-id-789"
amount: "1000"
liters: "50"  // Required for Fuel category
category: "Fuel"  // or "Other"
billNumber: "BILL001"
paymentMode: "cash"  // or "card" or "upi"
attachments: (files, optional - max 5)
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "transaction": {
      "_id": "txn-id-001",
      "amount": 1000,
      "liters": 50,
      "pointsEarned": 50,  // 1 point per liter (from SystemConfig)
      "category": "Fuel",
      "pumpId": "pump-id-789",
      "userId": "user-id-001"
    },
    "pointsEarned": 50,
    "walletBalance": 50  // User's new balance
  }
}
```

**Points Calculation:**
- **Fuel:** `liters × pointsPerLiter` (default: 1 point/liter)
- **Other:** `(amount / 100) × pointsPer100` (default: 5 points/₹100)
- **Campaign multipliers** are applied automatically if active

---

### Step 5.4: View Transaction History

**API:** `GET /api/transactions`

**Query Parameters:**
- `page`, `limit`: Pagination
- `pumpId`: Filter by pump
- `userId`: Filter by user
- `category`: Filter by category
- `startDate`, `endDate`: Date range

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "txn-id-001",
        "amount": 1000,
        "pointsEarned": 50,
        "category": "Fuel",
        "createdAt": "2026-02-19T14:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

## 6. Redemption Flow

### Flow 6A: User-Initiated Redemption (Reward)

### Step 6A.1: User Views Available Rewards

**API:** `GET /api/rewards`

**Query Parameters:**
- `pumpId` (optional): Filter by pump

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "reward-id-001",
        "name": "Free Coffee",
        "type": "freeItem",
        "pointsRequired": 100,
        "value": 50,
        "description": "Get a free coffee"
      }
    ]
  }
}
```

---

### Step 6A.2: User Requests Redemption

**API:** `POST /api/redeem`

**Headers:**
```
Authorization: Bearer <user-access-token>
Content-Type: application/json
Idempotency-Key: unique-key-456
```

**Request:**
```json
{
  "rewardId": "reward-id-001",
  "pointsUsed": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Redemption created successfully",
  "data": {
    "redemption": {
      "_id": "redemption-id-001",
      "status": "PENDING",
      "pointsUsed": 100,
      "redemptionCode": "RED12345678"  // Unique code for verification
    },
    "redemptionCode": "RED12345678"
  }
}
```

**Important:**
- Points are deducted immediately
- Status is `PENDING` - requires manager approval
- User receives `redemptionCode` to show at pump

---

### Step 6A.3: Manager Approves Redemption

**API:** `POST /api/manager/redemptions/:id/approve`

**Headers:**
```
Authorization: Bearer <manager-access-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Redemption approved successfully",
  "data": {
    "redemption": {
      "_id": "redemption-id-001",
      "status": "APPROVED"
    }
  }
}
```

**Manager can also reject:**
- `POST /api/manager/redemptions/:id/reject` with `{"reason": "Invalid code"}`

---

### Flow 6B: At-Pump Redemption (Direct Points Deduction)

### Step 6B.1: Staff Scans QR Code

**API:** `POST /api/scan/validate`

**Request:**
```json
{
  "identifier": "LOY12345678"
}
```

---

### Step 6B.2: Staff Deducts Points

**API:** `POST /api/manager/redeem` (or `/api/staff/redeem`)

**Headers:**
```
Authorization: Bearer <manager-or-staff-access-token>
Content-Type: application/json
```

**Request:**
```json
{
  "identifier": "LOY12345678",
  "pointsToDeduct": 100,
  "pumpId": "pump-id-789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Redemption created successfully",
  "data": {
    "redemption": {
      "_id": "redemption-id-002",
      "status": "APPROVED",  // Auto-approved for at-pump
      "pointsUsed": 100
    },
    "wallet": {
      "availablePoints": 50,  // Updated balance
      "totalEarned": 150,
      "redeemedPoints": 100
    },
    "user": {
      "_id": "user-id-001",
      "fullName": "John Doe",
      "mobile": "9876543212"
    }
  }
}
```

**Important:**
- Status is automatically `APPROVED` (no approval needed)
- Points deducted immediately
- Updated wallet balance returned

---

## 7. Points Expiry Flow

### Step 7.1: Automatic Expiry Processing

**Cron Job:** Runs daily at 12:00 AM

**Process:**
1. System checks all points ledger entries
2. Finds points older than expiry duration (default: 12 months)
3. Uses FIFO (First In First Out) logic
4. Deducts expired points from user wallet
5. Updates `expiredPoints` in wallet summary
6. Sends notifications (if configured)

**No API call needed - automatic background process.**

---

### Step 7.2: Points Expiry Notifications

**Notifications sent at:**
- 30 days before expiry
- 7 days before expiry
- 1 day before expiry

**Notification sent via:**
- Push notification (FCM)
- SMS (if configured)
- In-app notification

**User can view notifications:**
- `GET /api/notifications/my`

---

## 8. Campaign Flow

### Step 8.1: Admin Creates Campaign

**API:** `POST /api/admin/campaigns`

**Headers:**
```
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Double Points Weekend",
  "type": "multiplier",
  "multiplier": 2,
  "startDate": "2026-02-20T00:00:00Z",
  "endDate": "2026-02-23T23:59:59Z",
  "pumpIds": [],  // Empty = all pumps
  "conditions": {
    "minAmount": 500,
    "categories": ["Fuel"],
    "userSegment": "all"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "campaign-id-001",
    "name": "Double Points Weekend",
    "multiplier": 2,
    "status": "active"
  }
}
```

---

### Step 8.2: Campaign Applied Automatically

When a transaction is created during campaign period:
- System checks if transaction matches campaign conditions
- Applies multiplier/bonus automatically
- Points are calculated: `basePoints × multiplier`

**Example:**
- Base points: 50 (from 50 liters × 1 point/liter)
- Campaign multiplier: 2
- Final points: 50 × 2 = 100 points

**No API call needed - automatic during transaction creation.**

---

### Step 8.3: Manager Creates Campaign (Pump-Scoped)

**API:** `POST /api/manager/campaigns`

**Request:**
```json
{
  "name": "Weekend Special",
  "type": "multiplier",
  "multiplier": 1.5,
  "startDate": "2026-02-20T00:00:00Z",
  "endDate": "2026-02-23T23:59:59Z",
  "pumpIds": ["pump-id-789"]  // Must be manager's pump
}
```

**Note:** Manager can only create campaigns for their own pump(s).

---

## 9. Dashboard Flow

### Step 9.1: Admin Dashboard

**API:** `GET /api/admin/dashboard`

**Headers:**
```
Authorization: Bearer <admin-access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1000,
      "newToday": 10,
      "newThisMonth": 150,
      "active": 950
    },
    "transactions": {
      "total": 5000,
      "today": 50,
      "thisMonth": 500
    },
    "revenue": {
      "today": 50000,
      "thisMonth": 500000,
      "lastMonth": 450000,
      "growth": 11.11
    },
    "points": {
      "totalEarned": 1000000,
      "totalRedeemed": 500000,
      "totalExpired": 50000,
      "available": 450000
    },
    "redemptions": {
      "total": 1000,
      "today": 10,
      "thisMonth": 100
    }
  }
}
```

---

### Step 9.2: Manager Dashboard

**API:** `GET /api/manager/dashboard`

**Headers:**
```
Authorization: Bearer <manager-access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": {
      "today": 20,
      "thisMonth": 200
    },
    "revenue": {
      "today": 20000,
      "thisMonth": 200000
    },
    "pointsIssued": {
      "today": 2000,
      "thisMonth": 20000
    },
    "redemptions": {
      "today": 5,
      "thisMonth": 50
    }
  }
}
```

**Note:** Manager only sees data for their assigned pump(s).

---

## 10. Owner/Fleet Management Flow

### Step 10.1: Owner Registration

**API:** `POST /api/auth/register`

**Request Body (form-data):**
```
accountType: "organization"
ownerType: "non-registered"
ownerName: "Fleet Owner Name"
ownerMobile: "9876543216"
ownerEmail: "owner@example.com"
fullName: "Driver Name"
mobile: "9876543217"
vehicleNumber: "MH12AB9999"
vehicleType: "Four-Wheeler"
fuelType: "Petrol"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "owner-id-001",
      "role": "user",
      "ownerId": null  // Owner has no owner
    },
    "vehicle": {
      "loyaltyId": "LOY12345680"
    }
  }
}
```

---

### Step 10.2: Owner Adds Vehicle to Fleet

**API:** `POST /api/owner/vehicles`

**Headers:**
```
Authorization: Bearer <owner-access-token>
Content-Type: multipart/form-data
```

**Request Body (form-data):**
```
fullName: "Driver Name"
mobile: "9876543218"
vehicleNumber: "MH12AB8888"
vehicleType: "Four-Wheeler"
fuelType: "Petrol"
profilePhoto: (file, optional)
driverPhoto: (file, optional)
rcPhoto: (file, optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "driver-id-001",
      "ownerId": "owner-id-001"  // Linked to owner
    },
    "vehicle": {
      "loyaltyId": "LOY12345681"
    }
  }
}
```

---

### Step 10.3: Owner Views Fleet Aggregation

**API:** `GET /api/owner/fleet-aggregation`

**Headers:**
```
Authorization: Bearer <owner-access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFleetPoints": 5000,
    "vehicles": [
      {
        "vehicleId": "vehicle-id-001",
        "vehicleNumber": "MH12AB9999",
        "driverName": "Driver 1",
        "points": 2000
      },
      {
        "vehicleId": "vehicle-id-002",
        "vehicleNumber": "MH12AB8888",
        "driverName": "Driver 2",
        "points": 3000
      }
    ]
  }
}
```

---

### Step 10.4: Transaction with Owner ID

When scanning owner's QR code (instead of vehicle QR):

**API:** `POST /api/transactions`

**Request:**
```
identifier: "owner-id-001"  // Owner ID instead of loyaltyId
pumpId: "pump-id-789"
amount: "2000"
liters: "100"
category: "Fuel"
```

**Points go to owner's wallet, not driver's wallet.**

---

## Complete End-to-End Flow Example

### Scenario: New Customer Earns and Redeems Points

#### 1. Customer Registration
```
POST /api/auth/send-otp → {mobile: "9876543212"}
POST /api/auth/register → {fullName, mobile, vehicle...}
→ Receives: loyaltyId "LOY12345678", accessToken
```

#### 2. Customer Visits Pump
```
Customer arrives at pump
Staff scans QR code: POST /api/scan/validate → {identifier: "LOY12345678"}
→ Validates customer identity
```

#### 3. Customer Makes Purchase
```
Staff creates transaction: POST /api/transactions
→ {identifier: "LOY12345678", amount: 1000, liters: 50, category: "Fuel"}
→ Customer earns: 50 points (50 liters × 1 point/liter)
```

#### 4. Customer Views Wallet
```
Customer checks balance: GET /api/user/:userId/wallet
→ Shows: availablePoints: 50, totalEarned: 50
```

#### 5. Customer Redeems Points
```
Option A - Reward Redemption:
POST /api/redeem → {rewardId: "...", pointsUsed: 50}
→ Gets redemptionCode "RED12345678"
→ Shows code to manager
→ Manager approves: POST /api/manager/redemptions/:id/approve

Option B - Direct Points Deduction:
Staff scans QR: POST /api/scan/validate
Staff deducts: POST /api/manager/redeem → {pointsToDeduct: 50}
→ Points deducted immediately, status: APPROVED
```

#### 6. Customer Checks Updated Balance
```
GET /api/user/:userId/wallet
→ Shows: availablePoints: 0, redeemedPoints: 50
```

---

## Key API Endpoints Summary

| Flow | Endpoint | Method | Auth Required |
|------|----------|--------|---------------|
| **Admin Login** | `/api/admin/login` | POST | No |
| **User Registration** | `/api/auth/register` | POST | No |
| **User Login** | `/api/auth/send-otp` → `/api/auth/verify-otp` | POST | No |
| **Create Manager** | `/api/admin/users` | POST | Admin |
| **Create Staff** | `/api/admin/users` or `/api/manager/users` | POST | Admin/Manager |
| **Create Pump** | `/api/admin/pumps` | POST | Admin |
| **Create Transaction** | `/api/transactions` | POST | Manager/Staff |
| **User Redemption** | `/api/redeem` | POST | User |
| **At-Pump Redemption** | `/api/manager/redeem` | POST | Manager/Staff |
| **Approve Redemption** | `/api/manager/redemptions/:id/approve` | POST | Manager |
| **View Dashboard** | `/api/admin/dashboard` or `/api/manager/dashboard` | GET | Admin/Manager |
| **View Wallet** | `/api/user/:userId/wallet` | GET | User/Admin/Manager |
| **Fleet Aggregation** | `/api/owner/fleet-aggregation` | GET | Owner |

---

## Authentication Flow

### For Users (OTP-Based)
1. `POST /api/auth/send-otp` → Receive OTP via SMS
2. `POST /api/auth/verify-otp` → Verify OTP, get tokens
3. Use `accessToken` in `Authorization: Bearer <token>` header

### For Admin/Manager/Staff (Password-Based)
1. `POST /api/auth/login` → Login with email/phone + password
2. Receive `accessToken` and `refreshToken`
3. Use `accessToken` in `Authorization: Bearer <token>` header
4. Refresh token: `POST /api/auth/refresh` when accessToken expires

---

## Points Flow Summary

1. **Earning Points:**
   - Transaction created → Points calculated → Added to wallet
   - Campaign multipliers applied automatically
   - Registration points (when manager/staff creates user)
   - Referral points (when user registers with referral code)

2. **Using Points:**
   - User-initiated redemption → Points deducted → Status: PENDING → Manager approves
   - At-pump redemption → Points deducted → Status: APPROVED (immediate)

3. **Expiring Points:**
   - Daily cron job checks expiry
   - FIFO logic (oldest points expire first)
   - Expired points moved to `expiredPoints` in wallet summary

---

## Important Notes

1. **Idempotency:** Use `Idempotency-Key` header for critical operations (transactions, redemptions) to prevent duplicates

2. **Pump Scope:** Manager/staff can only access data for their assigned pump(s)

3. **Role Hierarchy:**
   - Admin: Full access
   - Manager: Pump-scoped access, can create staff
   - Staff: Pump-scoped access, can create users
   - User: Own resources only

4. **File Uploads:** Use `multipart/form-data` for endpoints that accept files (registration, transactions)

5. **Points Calculation:**
   - Fuel: `liters × pointsPerLiter` (default: 1 point/liter)
   - Other: `(amount / 100) × pointsPer100` (default: 5 points/₹100)
   - Campaign multipliers applied on top

---

**Last Updated:** February 23, 2026
