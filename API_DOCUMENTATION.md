# API Documentation - Scan2Reward Backend

**Base URL:** `http://localhost:3000` (or your server URL)  
**Version:** 1.0.0  
**Last Updated:** February 23, 2026

**See also:** [PROJECT_UPDATES.md](./PROJECT_UPDATES.md) for userType (owner/driver/individual), owner-only registration, no points expiry, redemption (admin direct vs approval), wallet visibility (driver vs owner), and multiple pumps.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Admin APIs](#admin-apis)
3. [Manager APIs](#manager-apis)
4. [Staff APIs](#staff-apis)
5. [User APIs](#user-apis)
6. [Owner APIs](#owner-apis)
7. [Transactions](#transactions)
8. [Redemptions](#redemptions)
9. [Scan & Validation](#scan--validation)
10. [Rewards (Public)](#rewards-public)
11. [Banners (Public)](#banners-public)
12. [Notifications](#notifications)
13. [Health Check](#health-check)

---

## Authentication

### 1. Send OTP
**Endpoint:** `POST /api/auth/send-otp`  
**Access:** Public  
**Description:** Send OTP to mobile number for login/registration

**Request Body:**
```json
{
  "mobile": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "mobile": "9876543210",
    "expiresAt": "2026-02-19T18:30:00.000Z"
  }
}
```

---

### 2. Verify OTP
**Endpoint:** `POST /api/auth/verify-otp`  
**Access:** Public  
**Description:** Verify OTP and login/register user

**Request Body:**
```json
{
  "mobile": "9876543210",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "user": {
      "_id": "...",
      "fullName": "John Doe",
      "mobile": "9876543210",
      "role": "user"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

---

### 3. Register
**Endpoint:** `POST /api/auth/register`  
**Access:** Public  
**Description:** Register new user with vehicle details

**Request Body (form-data):**
```
fullName: "John Doe"
mobile: "9876543210"
email: "john@example.com"
accountType: "individual" | "organization"
vehicleNumber: "MH12AB1234"
vehicleType: "Four-Wheeler"
fuelType: "Petrol"
referralCode: "" (optional)
profilePhoto: (file, optional)
driverPhoto: (file, optional)
ownerPhoto: (file, optional)
rcPhoto: (file, optional)
```

**For Organization (Fleet):**
```
accountType: "organization"
ownerType: "registered" | "non-registered"
ownerId: "" (if registered owner)
ownerName: "Owner Name" (if non-registered)
ownerMobile: "9876543211" (if non-registered)
ownerEmail: "owner@example.com" (if non-registered)
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {...},
    "vehicle": {...},
    "loyaltyId": "LOY12345678",
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

### 4. Login (Admin/Manager/Staff)
**Endpoint:** `POST /api/auth/login`  
**Access:** Public  
**Description:** Login with email/phone and password for admin/manager/staff

**Request Body:**
```json
{
  "identifier": "admin@gmail.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {...},
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

### 5. Admin Login (Legacy)
**Endpoint:** `POST /api/admin/login`  
**Access:** Public  
**Description:** Legacy admin login using Admin model (email + password)

**Request Body:**
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
  "message": "Admin logged in successfully",
  "data": {
    "user": {
      "_id": "...",
      "name": "admin",
      "email": "admin@gmail.com",
      "userType": "Admin"
    },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

### 6. Refresh Token
**Endpoint:** `POST /api/auth/refresh`  
**Access:** Public  
**Description:** Get new access and refresh tokens using a valid refresh token. Refresh tokens are stored in MongoDB; rotation is applied (old token revoked, new one issued). If the refresh token is expired/revoked/invalid, the backend logs out only the device associated with that token (if identifiable via fcmToken) and returns 401.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

### 7. Logout
**Endpoint:** `POST /api/auth/logout`  
**Access:** Authenticated (Bearer Token)  
**Description:** Log out the user. Optional body: `refreshToken`, `fcmToken`. If `fcmToken` is provided, only that device is logged out; if `refreshToken` is provided, only that token is revoked; if neither is provided, all devices are logged out.

**Headers:** `Authorization: Bearer <access-token>`

**Request Body (optional):**
```json
{
  "refreshToken": "eyJhbGci...",
  "fcmToken": "fcm-device-token..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": { "loggedOutDevices": 1 }
}
```

---

## Admin APIs

**Base Path:** `/api/admin`  
**Authentication:** Required (Bearer Token)  
**Required Role:** `admin`

### Dashboard

#### Get Admin Dashboard
**Endpoint:** `GET /api/admin/dashboard`  
**Description:** Get aggregated statistics for admin dashboard

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

### Users Management

#### Create User (Admin can create Manager, Staff, or User)
**Endpoint:** `POST /api/admin/users`  
**Description:** Create a new user, manager, or staff member (admin only)

**Request Body:**
```json
{
  "fullName": "John Doe",
  "mobile": "9876543210",
  "email": "john@example.com",
  "role": "user" | "manager" | "staff",  // Required: specify role
  "password": "password123",  // Required for manager/staff, optional for user
  "vehicle": {  // Optional: only for regular users
    "vehicleNumber": "MH12AB1234",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

**Note:** 
- **Admin can create Manager:** Set `"role": "manager"` - password required; managerCode and referral code auto-generated. **accountType** not needed (ignored for manager/staff).
- **Admin can create Staff:** Set `"role": "staff"` - password required; staffCode and referral code auto-generated; optional `assignedManagerId`, `pumpId`. **accountType** not needed.
- **Admin can create User:** Set `"role": "user"` (or omit) - optional **accountType**: `"individual"` (default) or `"organization"`. For organization: **ownerType** `"registered"` (use **ownerIdentifier** to link) or `"non-registered"` (send **owner** object to create owner + driver). Optional files: profilePhoto, driverPhoto, ownerPhoto, rcPhoto.
- **Password:** Minimum 6 characters, required for manager/staff roles.
- Manager restricted to one pump; staff restricted to one manager and one pump. Response may include `assignment` and `ownerId` when applicable.

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "_id": "...",
      "fullName": "John Doe",
      "mobile": "9876543210",
      "email": "john@example.com",
      "role": "manager",  // or "staff" or "user"
      "referralCode": "REF12345678"  // Auto-generated for manager/staff
    },
    "vehicle": {...}  // If vehicle was provided
  }
}
```

---

#### List Users
**Endpoint:** `GET /api/admin/users`  
**Description:** List all users with filters and pagination

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `role` (optional): Filter by role (user, manager, staff, admin)
- `status` (optional): Filter by status (active, inactive, blocked)
- `search` (optional): Search by name, mobile, or email

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 1000,
    "page": 1,
    "limit": 20,
    "totalPages": 50
  }
}
```

---

#### Get User by ID
**Endpoint:** `GET /api/admin/users/:userId`  
**Description:** Get user details by ID

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "vehicles": [...],
    "wallet": {...}
  }
}
```

---

#### Update User
**Endpoint:** `PATCH /api/admin/users/:userId`  
**Description:** Update user details

**Request Body:**
```json
{
  "fullName": "John Updated",
  "email": "johnupdated@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {...}
}
```

---

#### Update User Status
**Endpoint:** `PATCH /api/admin/users/:userId/status`  
**Description:** Block or unblock a user

**Request Body:**
```json
{
  "status": "blocked" | "active" | "inactive"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User status updated successfully",
  "data": {...}
}
```

---

### Pumps Management

#### Create Pump
**Endpoint:** `POST /api/admin/pumps`  
**Description:** Create a new pump

**Request Body:**
```json
{
  "name": "Pump 1",
  "code": "PMP001",
  "location": {
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "lat": 19.0760,
    "lng": 72.8777
  },
  "managerId": "" | null | "valid-object-id" (optional - can be empty)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pump created successfully",
  "data": {...}
}
```

---

#### List Pumps
**Endpoint:** `GET /api/admin/pumps`  
**Description:** List all pumps

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 10
  }
}
```

---

#### Get Pump by ID
**Endpoint:** `GET /api/admin/pumps/:pumpId`  
**Description:** Get pump details by ID

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

#### Update Pump
**Endpoint:** `PATCH /api/admin/pumps/:pumpId`  
**Description:** Update pump details

**Request Body:**
```json
{
  "name": "Pump 1 Updated",
  "managerId": "" | null | "valid-object-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pump updated successfully",
  "data": {...}
}
```

---

#### Delete Pump
**Endpoint:** `DELETE /api/admin/pumps/:pumpId`  
**Description:** Delete a pump

**Response:**
```json
{
  "success": true,
  "message": "Pump deleted successfully"
}
```

---

### Campaigns Management

#### Create Campaign
**Endpoint:** `POST /api/admin/campaigns`  
**Description:** Create a new campaign

**Request Body:**
```json
{
  "name": "Double Points Weekend",
  "type": "multiplier" | "bonusPoints" | "bonusPercentage",
  "multiplier": 2,
  "bonusPoints": 100,
  "bonusPercentage": 10,
  "startDate": "2026-02-20T00:00:00Z",
  "endDate": "2026-02-23T23:59:59Z",
  "pumpIds": [] (empty = all pumps),
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
  "message": "Campaign created successfully",
  "data": {...}
}
```

---

#### List Campaigns
**Endpoint:** `GET /api/admin/campaigns`  
**Description:** List all campaigns

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 10
  }
}
```

---

#### Get Campaign by ID
**Endpoint:** `GET /api/admin/campaigns/:campaignId`  
**Description:** Get campaign details

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

#### Update Campaign
**Endpoint:** `PATCH /api/admin/campaigns/:campaignId`  
**Description:** Update campaign details

**Request Body:**
```json
{
  "name": "Updated Campaign Name",
  "multiplier": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Campaign updated successfully",
  "data": {...}
}
```

---

#### Delete Campaign
**Endpoint:** `DELETE /api/admin/campaigns/:campaignId`  
**Description:** Delete a campaign

**Response:**
```json
{
  "success": true,
  "message": "Campaign deleted successfully"
}
```

---

### Banners Management

#### Create Banner
**Endpoint:** `POST /api/admin/banners`  
**Description:** Create a new banner

**Request Body:**
```json
{
  "title": "Special Offer",
  "description": "Get 50% off",
  "imageUrl": "https://example.com/banner.jpg",
  "linkUrl": "https://example.com/offer",
  "startTime": "2026-02-20T00:00:00Z",
  "endTime": "2026-02-27T23:59:59Z",
  "pumpIds": [] (empty = global)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Banner created successfully",
  "data": {...}
}
```

---

#### List Banners
**Endpoint:** `GET /api/admin/banners`  
**Description:** List all banners

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 10
  }
}
```

---

#### Get Banner by ID
**Endpoint:** `GET /api/admin/banners/:bannerId`  
**Description:** Get banner details

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

#### Update Banner
**Endpoint:** `PATCH /api/admin/banners/:bannerId`  
**Description:** Update banner details

**Request Body:**
```json
{
  "title": "Updated Banner"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Banner updated successfully",
  "data": {...}
}
```

---

#### Delete Banner
**Endpoint:** `DELETE /api/admin/banners/:bannerId`  
**Description:** Delete a banner

**Response:**
```json
{
  "success": true,
  "message": "Banner deleted successfully"
}
```

---

### Rewards Management

#### Create Reward
**Endpoint:** `POST /api/admin/rewards`  
**Description:** Create a new reward

**Request Body:**
```json
{
  "name": "Free Coffee",
  "type": "discount" | "freeItem" | "cashback" | "voucher",
  "pointsRequired": 100,
  "value": 50,
  "discountType": "percentage" | "fixed" | "free",
  "availability": "unlimited" | "limited",
  "totalQuantity": 1000,
  "validFrom": "2026-02-20T00:00:00Z",
  "validUntil": "2026-12-31T23:59:59Z",
  "applicablePumps": [] (empty = all pumps),
  "description": "Get a free coffee",
  "imageUrl": "https://example.com/reward.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reward created successfully",
  "data": {...}
}
```

---

#### List Rewards
**Endpoint:** `GET /api/admin/rewards`  
**Description:** List all rewards

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 20
  }
}
```

---

#### Get Reward by ID
**Endpoint:** `GET /api/admin/rewards/:rewardId`  
**Description:** Get reward details

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

#### Update Reward
**Endpoint:** `PATCH /api/admin/rewards/:rewardId`  
**Description:** Update reward details

**Request Body:**
```json
{
  "pointsRequired": 150
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reward updated successfully",
  "data": {...}
}
```

---

#### Delete Reward
**Endpoint:** `DELETE /api/admin/rewards/:rewardId`  
**Description:** Delete a reward

**Response:**
```json
{
  "success": true,
  "message": "Reward deleted successfully"
}
```

---

### Wallet Management

#### Adjust Wallet
**Endpoint:** `POST /api/admin/wallet/adjust`  
**Description:** Manually adjust user's wallet points

**Request Body:**
```json
{
  "userId": "user-object-id",
  "points": 100,
  "type": "adjustment" | "credit" | "debit",
  "reason": "Manual adjustment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet adjusted successfully",
  "data": {
    "ledgerEntry": {...},
    "walletSummary": {...}
  }
}
```

---

### Staff Assignments Management

#### Assign Staff to Pump
**Endpoint:** `POST /api/admin/staff-assignments`  
**Description:** Assign a staff member to a pump (required before staff can create transactions)

**Request Body:**
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

**Note:** 
- Staff can be assigned to **multiple pumps**
- If assignment already exists (inactive), it will be reactivated
- Staff must be assigned to pump before they can create transactions

---

#### List Staff Assignments
**Endpoint:** `GET /api/admin/staff-assignments`  
**Description:** List all staff assignments with filters

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `staffId` (optional): Filter by staff ID
- `pumpId` (optional): Filter by pump ID
- `status` (optional): Filter by status (`active`, `inactive`)

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

#### Get Assignments for Staff
**Endpoint:** `GET /api/admin/staff-assignments/staff/:staffId`  
**Description:** Get all pump assignments for a specific staff member

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "assignment-id",
      "pumpId": {
        "_id": "pump-id",
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

#### Get Staff for Pump
**Endpoint:** `GET /api/admin/staff-assignments/pump/:pumpId`  
**Description:** Get all staff assigned to a specific pump

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "assignment-id",
      "userId": {
        "_id": "staff-id",
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

#### Remove Staff from Pump
**Endpoint:** `DELETE /api/admin/staff-assignments/:assignmentId`  
**Description:** Remove staff from pump (sets status to inactive)

**Response:**
```json
{
  "success": true,
  "message": "Staff removed from pump successfully"
}
```

**Note:** This is a soft delete (sets `status: 'inactive'`). Staff can be reassigned later.

---

### System Config

#### Get Config
**Endpoint:** `GET /api/admin/config`  
**Description:** Get system configuration

**Response:**
```json
{
  "success": true,
  "data": {
    "points": {
      "fuel": 1,
      "other": 5,
      "registration": 50,
      "referral": 100
    },
    "pointsExpiry": {
      "durationMonths": 12,
      "notificationDays": [30, 7, 1]
    }
  }
}
```

---

#### Update Config
**Endpoint:** `PATCH /api/admin/config`  
**Description:** Update system configuration

**Request Body:**
```json
{
  "points": {
    "fuel": 1,
    "other": 5,
    "registration": 50,
    "referral": 100
  },
  "pointsExpiry": {
    "durationMonths": 12,
    "notificationDays": [30, 7, 1]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Config updated successfully",
  "data": {...}
}
```

---

## Manager APIs

**Base Path:** `/api/manager`  
**Authentication:** Required (Bearer Token)  
**Required Role:** `manager`  
**Note:** All manager APIs are pump-scoped (only access to assigned pump(s))

### Dashboard

#### Get Manager Dashboard
**Endpoint:** `GET /api/manager/dashboard`  
**Description:** Get pump-scoped statistics for manager dashboard

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

---

### Users Management

#### Create User or Staff (Manager can create Staff or User)
**Endpoint:** `POST /api/manager/users`  
**Description:** Create a new user (customer) or staff member at pump (manager's pump-scoped)

**Request Body:**
```json
{
  "fullName": "John Doe",
  "mobile": "9876543210",
  "email": "john@example.com",
  "role": "user" | "staff",  // Optional: "user" (default) or "staff"
  "password": "password123",  // Required for staff, optional for user
  "vehicle": {  // Optional: only for regular users
    "vehicleNumber": "MH12AB1234",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "_id": "...",
      "fullName": "John Doe",
      "mobile": "9876543210",
      "role": "staff",  // or "user"
      "referralCode": "REF12345678"  // Auto-generated for staff
    },
    "vehicle": {...}  // If vehicle was provided (only for users)
  }
}
```

**Important Notes:**
- **Manager CAN create Staff:** Set `"role": "staff"` - password required, referral code is auto-generated
- **Manager CAN create User:** Set `"role": "user"` or omit (defaults to "user") - password optional
- **Manager CANNOT create Manager:** Only admin can create managers
- **Password:** Minimum 6 characters, required for staff (they login with password)
- **Registration points:** Automatically credited to the manager when creating regular users (not staff)
- **Staff assignment:** Staff created by manager may need to be assigned to pumps separately via StaffAssignment

---

### Transactions

#### List Transactions
**Endpoint:** `GET /api/manager/transactions`  
**Description:** List transactions for manager's pump(s)

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `pumpId` (optional): Filter by pump ID
- `userId` (optional): Filter by user ID
- `category` (optional): Filter by category
- `status` (optional): Filter by status
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 500,
    "page": 1,
    "limit": 20
  }
}
```

---

#### Get Transaction by ID
**Endpoint:** `GET /api/manager/transactions/:transactionId`  
**Description:** Get transaction details

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

### Campaigns Management

#### Create Campaign
**Endpoint:** `POST /api/manager/campaigns`  
**Description:** Create a campaign (restricted to manager's pump(s))

**Request Body:**
```json
{
  "name": "Weekend Special",
  "type": "multiplier",
  "multiplier": 1.5,
  "startDate": "2026-02-20T00:00:00Z",
  "endDate": "2026-02-23T23:59:59Z",
  "pumpIds": ["pump-id-1"] (must be manager's pump)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Campaign created successfully",
  "data": {...}
}
```

**Note:** Manager can only assign campaigns to their own pump(s).

---

#### List Campaigns
**Endpoint:** `GET /api/manager/campaigns`  
**Description:** List campaigns for manager's pump(s)

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 5
  }
}
```

---

#### Get Campaign by ID
**Endpoint:** `GET /api/manager/campaigns/:campaignId`  
**Description:** Get campaign details

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

#### Update Campaign
**Endpoint:** `PATCH /api/manager/campaigns/:campaignId`  
**Description:** Update campaign (only if manager owns it)

**Request Body:**
```json
{
  "name": "Updated Campaign"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Campaign updated successfully",
  "data": {...}
}
```

---

#### Delete Campaign
**Endpoint:** `DELETE /api/manager/campaigns/:campaignId`  
**Description:** Delete campaign (only if manager owns it)

**Response:**
```json
{
  "success": true,
  "message": "Campaign deleted successfully"
}
```

---

### Banners Management

#### Create Banner
**Endpoint:** `POST /api/manager/banners`  
**Description:** Create a banner (restricted to manager's pump(s))

**Request Body:**
```json
{
  "title": "Manager Banner",
  "description": "Special offer",
  "imageUrl": "https://example.com/banner.jpg",
  "startTime": "2026-02-20T00:00:00Z",
  "endTime": "2026-02-27T23:59:59Z",
  "pumpIds": ["pump-id-1"] (must be manager's pump)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Banner created successfully",
  "data": {...}
}
```

---

#### List Banners
**Endpoint:** `GET /api/manager/banners`  
**Description:** List banners for manager's pump(s)

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 5
  }
}
```

---

#### Get Banner by ID
**Endpoint:** `GET /api/manager/banners/:bannerId`  
**Description:** Get banner details

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

#### Update Banner
**Endpoint:** `PATCH /api/manager/banners/:bannerId`  
**Description:** Update banner (only if manager owns it)

**Request Body:**
```json
{
  "title": "Updated Banner"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Banner updated successfully",
  "data": {...}
}
```

---

#### Delete Banner
**Endpoint:** `DELETE /api/manager/banners/:bannerId`  
**Description:** Delete banner (only if manager owns it)

**Response:**
```json
{
  "success": true,
  "message": "Banner deleted successfully"
}
```

---

### Redemptions

#### At-Pump Redemption
**Endpoint:** `POST /api/manager/redeem`  
**Description:** Deduct points at pump (scan QR and deduct points)

**Request Body:**
```json
{
  "identifier": "LOY12345678" | "owner-id" | "9876543210",
  "pointsToDeduct": 100,
  "pumpId": "pump-object-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Redemption created successfully",
  "data": {
    "redemption": {...},
    "wallet": {
      "availablePoints": 900,
      "totalEarned": 1000,
      "redeemedPoints": 100
    },
    "user": {
      "_id": "...",
      "fullName": "John Doe",
      "mobile": "9876543210"
    }
  }
}
```

---

#### Approve Redemption
**Endpoint:** `POST /api/manager/redemptions/:id/approve`  
**Description:** Approve a pending redemption

**Response:**
```json
{
  "success": true,
  "message": "Redemption approved successfully",
  "data": {...}
}
```

---

#### Reject Redemption
**Endpoint:** `POST /api/manager/redemptions/:id/reject`  
**Description:** Reject a pending redemption (refunds points)

**Request Body:**
```json
{
  "reason": "Invalid redemption code"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Redemption rejected successfully",
  "data": {...}
}
```

---

### Wallet Management

#### Adjust Wallet
**Endpoint:** `POST /api/manager/wallet/adjust`  
**Description:** Manually adjust user's wallet (pump-scoped)

**Request Body:**
```json
{
  "userId": "user-object-id",
  "points": 50,
  "type": "adjustment",
  "reason": "Manual adjustment"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet adjusted successfully",
  "data": {...}
}
```

---

## Staff APIs

**Base Path:** `/api/staff`  
**Authentication:** Required (Bearer Token)  
**Required Role:** `staff`  
**Note:** All staff APIs are pump-scoped (only access to assigned pump(s))

### Users Management

#### Create User (Staff can only create regular Users, NOT Staff or Manager)
**Endpoint:** `POST /api/staff/users`  
**Description:** Create a new regular user (customer) at pump (staff's pump-scoped)

**Request Body:**
```json
{
  "fullName": "John Doe",
  "mobile": "9876543210",
  "email": "john@example.com",
  "vehicle": {  // Optional
    "vehicleNumber": "MH12AB1234",
    "vehicleType": "Four-Wheeler",
    "fuelType": "Petrol"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "_id": "...",
      "fullName": "John Doe",
      "mobile": "9876543210",
      "role": "user"  // Always "user", cannot create manager/staff
    },
    "vehicle": {...}  // If vehicle was provided
  }
}
```

**Important Notes:**
- **Staff CANNOT create Staff:** This endpoint only creates regular users (`role: "user"`)
- **Staff CANNOT create Manager:** Only admin can create managers
- **Registration points:** Automatically credited to the staff member who created the user
- **To create Staff:** Only admin can do this via `POST /api/admin/users` with `"role": "staff"`

---

### Redemptions

#### At-Pump Redemption
**Endpoint:** `POST /api/staff/redeem`  
**Description:** Deduct points at pump (scan QR and deduct points)

**Request Body:**
```json
{
  "identifier": "LOY12345678" | "owner-id" | "9876543210",
  "pointsToDeduct": 100,
  "pumpId": "pump-object-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Redemption created successfully",
  "data": {
    "redemption": {...},
    "wallet": {...},
    "user": {...}
  }
}
```

---

## User APIs

**Base Path:** `/api/user`  
**Authentication:** Required (Bearer Token)  
**Required Role:** `user`

### Referral Code

#### Get Referral Code
**Endpoint:** `GET /api/user/referral-code`  
**Description:** Get or generate referral code (for manager/staff only)

**Response:**
```json
{
  "success": true,
  "data": {
    "referralCode": "REF123456"
  }
}
```

**Note:** Only managers and staff have referral codes. Regular users will get an error.

---

### Vehicles

#### Get Vehicles
**Endpoint:** `GET /api/user/vehicles`  
**Description:** Get user's vehicles

**Query Parameters:**
- `userId` (optional): User ID (admin/manager can specify)

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "...",
        "vehicleNumber": "MH12AB1234",
        "loyaltyId": "LOY12345678",
        "vehicleType": "Four-Wheeler",
        "fuelType": "Petrol"
      }
    ]
  }
}
```

---

#### Add Vehicle
**Endpoint:** `POST /api/user/vehicles`  
**Description:** Add a new vehicle to user's account

**Request Body:**
```json
{
  "vehicleNumber": "MH12AB1234",
  "vehicleType": "Four-Wheeler",
  "fuelType": "Petrol",
  "brand": "Toyota",
  "model": "Camry",
  "yearOfManufacture": 2020
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vehicle added successfully",
  "data": {
    "vehicle": {...},
    "loyaltyId": "LOY12345678"
  }
}
```

---

#### Update Vehicle
**Endpoint:** `PATCH /api/user/vehicles/:vehicleId`  
**Description:** Update vehicle details

**Request Body:**
```json
{
  "brand": "Honda",
  "model": "Civic"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vehicle updated successfully",
  "data": {...}
}
```

---

### Wallet

#### Get Wallet
**Endpoint:** `GET /api/user/:userId/wallet`  
**Description:** Get user's wallet summary and ledger

**Query Parameters:**
- `page` (optional): Page number for ledger
- `limit` (optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "walletSummary": {
      "totalEarned": 1000,
      "availablePoints": 800,
      "redeemedPoints": 150,
      "expiredPoints": 50
    },
    "ledger": {
      "list": [...],
      "total": 50,
      "page": 1,
      "limit": 20
    }
  }
}
```

**Note:** Users can only access their own wallet. Admin/manager/staff can access any user's wallet.

---

## Owner APIs

**Base Path:** `/api/owner`  
**Authentication:** Required (Bearer Token) for most endpoints  
**Required Role:** `user` (with owner role)

### Fleet Aggregation

#### Get Fleet Aggregation
**Endpoint:** `GET /api/owner/fleet-aggregation`  
**Description:** Get aggregated points for all vehicles in fleet

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFleetPoints": 5000,
    "vehicles": [
      {
        "vehicleId": "...",
        "vehicleNumber": "MH12AB1234",
        "driverName": "Driver 1",
        "points": 1000
      }
    ]
  }
}
```

---

### Search Owner

#### Search Owner
**Endpoint:** `GET /api/owner/search`  
**Access:** Public  
**Description:** Search for owner by ID, phone, or email (for registration flow)

**Query Parameters:**
- `identifier`: Owner ID, phone, or email

**Response:**
```json
{
  "success": true,
  "data": {
    "owner": {
      "_id": "...",
      "fullName": "Owner Name",
      "mobile": "9876543211",
      "email": "owner@example.com"
    }
  }
}
```

---

### Fleet Vehicles

#### Add Vehicle to Fleet
**Endpoint:** `POST /api/owner/vehicles`  
**Description:** Add a vehicle (driver) to owner's fleet

**Request Body (form-data):**
```
fullName: "Driver Name"
mobile: "9876543210"
vehicleNumber: "MH12AB1234"
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
  "message": "Vehicle added to fleet successfully",
  "data": {
    "user": {...},
    "vehicle": {...}
  }
}
```

---

#### Get Fleet Vehicles
**Endpoint:** `GET /api/owner/vehicles`  
**Description:** Get all vehicles in owner's fleet

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 10
  }
}
```

---

## Transactions

**Base Path:** `/api/transactions`  
**Authentication:** Required (Bearer Token)  
**Required Roles:** `admin`, `manager`, `staff`

### Create Transaction

**Endpoint:** `POST /api/transactions`  
**Description:** Create a new transaction (points earned)

**Request Body (form-data):**
```
identifier: "LOY12345678" | "owner-id" | "9876543210"
pumpId: "pump-object-id"
amount: "1000"
liters: "50" (required for Fuel category)
category: "Fuel" | "Other"
billNumber: "BILL001"
paymentMode: "cash" | "card" | "upi"
attachments: (files, optional - max 5)
```

**Headers:**
- `Idempotency-Key` (optional): Unique key to prevent duplicate requests

**Response:**
```json
{
  "success": true,
  "message": "Transaction created successfully",
  "data": {
    "transaction": {...},
    "pointsEarned": 50,
    "walletBalance": 1050
  }
}
```

**Important Notes:**
- **`pumpId` is REQUIRED** - Every transaction stores which pump it happened at
- **Staff must be assigned to pump** before creating transactions (via `POST /api/admin/staff-assignments`)
- **Staff can only create transactions** for pumps they're assigned to (403 Forbidden if not assigned)
- **Manager can only create transactions** for their assigned pump(s)
- **Admin can create transactions** for any pump
- For `category: "Fuel"`, `liters` is required
- Points calculation: Fuel = 1 point/liter, Others = 5 points/₹100
- Campaign multipliers are applied automatically if active
- **Transaction tracking:** Admin/Manager can always see which pump a transaction happened at via `pumpId` field

---

### List Transactions

**Endpoint:** `GET /api/transactions`  
**Description:** List transactions with filters

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `pumpId` (optional): Filter by pump
- `userId` (optional): Filter by user
- `category` (optional): Filter by category
- `status` (optional): Filter by status
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 500,
    "page": 1,
    "limit": 20
  }
}
```

**Note:** Manager/staff can only see transactions for their assigned pump(s).

---

### Get Transaction by ID

**Endpoint:** `GET /api/transactions/:transactionId`  
**Description:** Get transaction details

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

## Redemptions

**Base Path:** `/api/redeem`  
**Authentication:** Required (Bearer Token) for most endpoints

### Create Redemption (User-Initiated)

**Endpoint:** `POST /api/redeem`  
**Required Role:** `user`  
**Description:** User requests redemption for a reward

**Request Body:**
```json
{
  "rewardId": "reward-object-id",
  "pointsUsed": 100
}
```

**Headers:**
- `Idempotency-Key` (optional): Unique key to prevent duplicate requests

**Response:**
```json
{
  "success": true,
  "message": "Redemption created successfully",
  "data": {
    "redemption": {...},
    "redemptionCode": "RED12345678"
  }
}
```

**Note:** Points are deducted immediately. Redemption status is `PENDING` and requires manager approval.

---

### At-Pump Redemption

**Endpoint:** `POST /api/redeem/at-pump`  
**Required Roles:** `admin`, `manager`, `staff`  
**Description:** Direct points deduction at pump (no reward required)

**Request Body:**
```json
{
  "identifier": "LOY12345678" | "owner-id" | "9876543210",
  "pointsToDeduct": 100,
  "pumpId": "pump-object-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Redemption created successfully",
  "data": {
    "redemption": {...},
    "wallet": {
      "availablePoints": 900
    },
    "user": {
      "_id": "...",
      "fullName": "John Doe",
      "mobile": "9876543210"
    }
  }
}
```

**Note:** Status is automatically `APPROVED` (no approval needed).

---

### List Redemptions

**Endpoint:** `GET /api/redeem`  
**Description:** List redemptions

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 100
  }
}
```

**Note:** Users see only their own redemptions. Admin/manager/staff see all.

---

### Get Redemption by ID

**Endpoint:** `GET /api/redeem/:redemptionId`  
**Description:** Get redemption details

**Response:**
```json
{
  "success": true,
  "data": {...}
}
```

---

### Verify Redemption Code

**Endpoint:** `POST /api/redeem/:code/verify`  
**Description:** Verify a redemption code

**Response:**
```json
{
  "success": true,
  "data": {
    "redemption": {...},
    "isValid": true,
    "isExpired": false
  }
}
```

---

### Use Redemption Code

**Endpoint:** `POST /api/redeem/:code/use`  
**Required Roles:** `admin`, `manager`, `staff`  
**Description:** Mark redemption code as used

**Response:**
```json
{
  "success": true,
  "message": "Redemption code used successfully",
  "data": {...}
}
```

---

## Scan & Validation

**Base Path:** `/api/scan`  
**Access:** Public

### Validate Identifier

**Endpoint:** `POST /api/scan/validate`  
**Description:** Validate loyalty ID, owner ID, or mobile number

**Request Body:**
```json
{
  "identifier": "LOY12345678" | "owner-id" | "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "vehicle": {...},
    "isOwner": false,
    "loyaltyId": "LOY12345678"
  }
}
```

**Note:**
- If `loyaltyId` → returns vehicle/driver user info
- If `owner ID` → returns owner user info (points go to owner)
- If `mobile` → returns user info

---

## Rewards (Public)

**Base Path:** `/api/rewards`  
**Access:** Public

### Get Rewards

**Endpoint:** `GET /api/rewards`  
**Description:** Get available rewards

**Query Parameters:**
- `pumpId` (optional): Filter by pump

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "...",
        "name": "Free Coffee",
        "type": "freeItem",
        "pointsRequired": 100,
        "value": 50,
        "description": "Get a free coffee",
        "imageUrl": "..."
      }
    ],
    "total": 20
  }
}
```

---

## Banners (Public)

**Base Path:** `/api/banners`  
**Access:** Public

### Get Active Banners

**Endpoint:** `GET /api/banners`  
**Description:** Get active banners

**Query Parameters:**
- `pumpId` (optional): Filter by pump

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "...",
        "title": "Special Offer",
        "description": "Get 50% off",
        "imageUrl": "...",
        "linkUrl": "..."
      }
    ],
    "total": 5
  }
}
```

**Note:** Only returns banners where `startTime ≤ now` and `endTime > now`.

---

## Notifications

**Base Path:** `/api/notifications`  
**Authentication:** Required (Bearer Token)

### Subscribe FCM Token

**Endpoint:** `POST /api/notifications/subscribeToken`  
**Required Role:** Any authenticated user  
**Description:** Subscribe FCM token for push notifications

**Request Body:**
```json
{
  "token": "fcm-token-here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token subscribed successfully"
}
```

---

### Get My Notifications

**Endpoint:** `GET /api/notifications/my`  
**Required Role:** Any authenticated user  
**Description:** Get user's notifications

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 50
  }
}
```

---

### Delete My Notification

**Endpoint:** `DELETE /api/notifications/my`  
**Required Role:** Any authenticated user  
**Description:** Delete notification(s)

**Request Body:**
```json
{
  "notificationIds": ["id1", "id2"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notifications deleted successfully"
}
```

---

### Send to All (Admin Only)

**Endpoint:** `POST /api/notifications/all`  
**Required Role:** `admin`  
**Description:** Send notification to all users

**Request Body:**
```json
{
  "title": "Notification Title",
  "body": "Notification Body",
  "link": "https://example.com",
  "img": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "data": {
    "notification": {...},
    "messageId": "..."
  }
}
```

---

### Send to Users (Admin Only)

**Endpoint:** `POST /api/notifications/`  
**Required Role:** `admin`  
**Description:** Send notification to specific users

**Request Body:**
```json
{
  "userIds": ["user-id-1", "user-id-2"],
  "title": "Notification Title",
  "body": "Notification Body",
  "link": "https://example.com",
  "img": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notifications sent successfully",
  "data": {
    "notifications": [...],
    "results": [...],
    "errors": []
  }
}
```

---

## Health Check

### Health Check

**Endpoint:** `GET /health`  
**Access:** Public  
**Description:** Basic health check

**Response:**
```json
{
  "success": true,
  "message": "OK",
  "timestamp": "2026-02-19T18:30:00.000Z"
}
```

---

### API Health Check

**Endpoint:** `GET /api/health`  
**Access:** Public  
**Description:** API health check

**Response:**
```json
{
  "success": true,
  "message": "OK",
  "timestamp": "2026-02-19T18:30:00.000Z"
}
```

---

## Authentication & Authorization

### How to Authenticate

1. **For Users (OTP Login):**
   - Call `POST /api/auth/send-otp` with mobile number
   - Call `POST /api/auth/verify-otp` with mobile and OTP
   - Receive `accessToken` and `refreshToken`
   - Use `accessToken` in `Authorization: Bearer <token>` header

2. **For Admin/Manager/Staff (Password Login):**
   - Call `POST /api/auth/login` with identifier and password
   - Or call `POST /api/admin/login` for legacy admin
   - Receive `accessToken` and `refreshToken`
   - Use `accessToken` in `Authorization: Bearer <token>` header

### Role-Based Access

- **Admin:** Full access to all endpoints
- **Manager:** Access to pump-scoped endpoints (only assigned pump(s))
- **Staff:** Access to pump-scoped endpoints (only assigned pump(s))
- **User:** Access to own resources only

### Pump Scope

- Managers automatically get access to pumps where `managerId = manager._id`
- Staff get access to pumps from `StaffAssignment` model
- All manager/staff queries are automatically filtered by `req.allowedPumpIds`

---

## Common Request/Response Patterns

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {...},
  "meta": null
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message here",
  "data": null,
  "meta": null
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "list": [...],
    "total": 1000,
    "page": 1,
    "limit": 20,
    "totalPages": 50
  }
}
```

---

## File Uploads

### Supported Formats
- **Images:** JPEG, PNG
- **Documents:** PDF
- **Max Size:** 5MB per file
- **Max Files:** 5 files per request (for transactions)

### Upload Endpoints
- `POST /api/auth/register` - User registration photos
- `POST /api/owner/vehicles` - Fleet vehicle photos
- `POST /api/transactions` - Transaction attachments (bills, receipts)

### Form-Data Format
All POST/PATCH endpoints support both:
- `application/json` (for simple data)
- `multipart/form-data` (for file uploads)

---

## Idempotency

### Supported Endpoints
- `POST /api/transactions` - Create transaction
- `POST /api/redeem` - Create redemption

### How to Use
Include `Idempotency-Key` header with a unique value:
```
Idempotency-Key: unique-key-123
```

If the same key is used within 24 hours, the cached response is returned.

---

## Rate Limiting

**Note:** Currently disabled for debugging. Will be enabled in production.

- **Global:** 100 requests per 15 minutes per IP
- **Auth Endpoints:** 5 requests per 15 minutes per IP (when enabled)

---

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Notes

1. **Base URL:** Update `{{baseUrl}}` in Postman to your server URL (default: `http://localhost:3000`)

2. **Token Expiry:**
   - Access Token: 24 hours (configurable)
   - Refresh Token: 7 days (configurable)

3. **Points Calculation:**
   - Fuel: 1 point per liter (configurable via SystemConfig)
   - Other categories: 5 points per ₹100 (configurable via SystemConfig)

4. **Points Expiry:**
   - Configurable duration (default: 12 months)
   - FIFO (First In First Out) logic
   - Daily cron job processes expirations at 12:00 AM
   - Notifications sent 30/7/1 days before expiry

5. **Referral System:**
   - Managers and staff get auto-generated referral codes
   - Users can register with referral code
   - Referrer gets points from SystemConfig when user registers

6. **Registration Points:**
   - When manager/staff creates a user, they get registration points
   - Points value configurable via SystemConfig

---

## User Creation Summary

### Who Can Create What?

| Role | Can Create Manager? | Can Create Staff? | Can Create User? | API Endpoint |
|------|-------------------|-------------------|------------------|--------------|
| **Admin** | ✅ Yes | ✅ Yes | ✅ Yes | `POST /api/admin/users` (with `role: "manager"`, `"staff"`, or `"user"`) |
| **Manager** | ❌ No | ✅ Yes | ✅ Yes | `POST /api/manager/users` (with `role: "staff"` or `"user"`) |
| **Staff** | ❌ No | ❌ No | ✅ Yes | `POST /api/staff/users` (always creates `role: "user"`) |

### Details:

1. **Admin Creates Manager:**
   - Use: `POST /api/admin/users`
   - Set: `"role": "manager"` and `"password": "password123"` (required)
   - Referral code is **auto-generated**
   - Manager can be assigned to pumps later

2. **Admin Creates Staff:**
   - Use: `POST /api/admin/users`
   - Set: `"role": "staff"` and `"password": "password123"` (required)
   - Referral code is **auto-generated**
   - Staff must be assigned to pumps via `StaffAssignment` model

3. **Admin Creates User:**
   - Use: `POST /api/admin/users`
   - Set: `"role": "user"` (or omit, defaults to "user")
   - Password is optional (users login with OTP)
   - Optional vehicle can be included

4. **Manager Creates Staff:**
   - Use: `POST /api/manager/users`
   - Set: `"role": "staff"` and `"password": "password123"` (required)
   - Referral code is **auto-generated**
   - Staff may need to be assigned to pumps separately via StaffAssignment
   - Manager does NOT get registration points for creating staff

5. **Manager Creates User:**
   - Use: `POST /api/manager/users`
   - Set: `"role": "user"` (or omit, defaults to "user")
   - Password is optional (users login with OTP)
   - Manager gets registration points
   - Optional vehicle can be included

6. **Staff Creates User:**
   - Use: `POST /api/staff/users`
   - **Cannot** specify role (always creates `role: "user"`)
   - Staff member gets registration points
   - Optional vehicle can be included

---

**Last Updated:** February 23, 2026
