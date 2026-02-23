# Complete Flow: Getting Manager IDs for Pump Creation/Update

## Overview

When creating or updating a pump, you need to assign a manager to it. This document explains the complete flow of how to get manager IDs and use them.

---

## Step-by-Step Flow

### Step 1: Get List of Managers

**Endpoint:** `GET /api/admin/users`  
**Authentication:** Required (Admin Bearer Token)  
**Description:** List all users filtered by role to get managers

**Request:**
```http
GET /api/admin/users?role=manager&limit=100
Authorization: Bearer <admin-access-token>
```

**Query Parameters:**
- `role` (required): Set to `"manager"` to filter only managers
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max recommended: 100)
- `status` (optional): Filter by status (`"active"`, `"inactive"`, `"blocked"`)
- `search` (optional): Search by name, mobile, or email

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "507f1f77bcf86cd799439011",  // ← This is the managerId
        "fullName": "John Manager",
        "mobile": "9876543210",
        "email": "john.manager@example.com",
        "role": "manager",
        "referralCode": "REF12345678",
        "status": "active",
        "createdAt": "2026-02-19T10:00:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439012",  // ← Another managerId
        "fullName": "Jane Manager",
        "mobile": "9876543211",
        "email": "jane.manager@example.com",
        "role": "manager",
        "referralCode": "REF12345679",
        "status": "active",
        "createdAt": "2026-02-19T11:00:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 100,
    "totalPages": 1
  }
}
```

**Important:** Copy the `_id` field from the manager you want to assign. This is the `managerId` you'll use.

---

### Step 2: Create Pump with Manager

**Endpoint:** `POST /api/admin/pumps`  
**Authentication:** Required (Admin Bearer Token)  
**Description:** Create a new pump and optionally assign a manager

**Request:**
```http
POST /api/admin/pumps
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Pump Station 1",
  "code": "PMP001",
  "managerId": "507f1f77bcf86cd799439011",  // ← Manager ID from Step 1
  "location": {
    "address": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "lat": 19.0760,
    "lng": 72.8777
  },
  "status": "active",
  "timezone": "Asia/Kolkata",
  "currency": "INR"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pump created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "name": "Pump Station 1",
    "code": "PMP001",
    "managerId": "507f1f77bcf86cd799439011",  // ← Manager assigned
    "location": {
      "address": "123 Main Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "lat": 19.0760,
      "lng": 72.8777
    },
    "status": "active",
    "createdAt": "2026-02-19T12:00:00.000Z",
    "updatedAt": "2026-02-19T12:00:00.000Z"
  }
}
```

**Note:** `managerId` is optional. You can:
- **Assign a manager:** Provide a valid MongoDB ObjectId (24 hex characters)
- **Leave empty:** Set `"managerId": ""` or omit the field (will be set to `null`)
- **Set to null:** Set `"managerId": null` (no manager assigned)

---

### Step 3: Update Pump Manager

**Endpoint:** `PATCH /api/admin/pumps/:pumpId`  
**Authentication:** Required (Admin Bearer Token)  
**Description:** Update pump details, including changing the manager

**Request:**
```http
PATCH /api/admin/pumps/507f1f77bcf86cd799439020
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

**Request Body (Update Manager Only):**
```json
{
  "managerId": "507f1f77bcf86cd799439012"  // ← New manager ID
}
```

**Request Body (Update Manager to None):**
```json
{
  "managerId": ""  // ← Empty string removes manager assignment
}
```

**Request Body (Update Multiple Fields):**
```json
{
  "name": "Updated Pump Name",
  "managerId": "507f1f77bcf86cd799439012",
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pump updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "name": "Updated Pump Name",
    "code": "PMP001",
    "managerId": "507f1f77bcf86cd799439012",  // ← Updated manager
    "status": "active",
    "updatedAt": "2026-02-19T13:00:00.000Z"
  }
}
```

---

## Complete Example Flow

### Scenario: Admin wants to create a pump and assign a manager

#### 1. Login as Admin
```http
POST /api/admin/login
Content-Type: application/json

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
    "user": {...},
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

#### 2. Get List of Managers
```http
GET /api/admin/users?role=manager&limit=100
Authorization: Bearer eyJhbGci...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
        "fullName": "Rajesh Kumar",
        "mobile": "9876543210",
        "email": "rajesh@example.com",
        "role": "manager",
        "status": "active"
      }
    ],
    "total": 1
  }
}
```

#### 3. Create Pump with Manager
```http
POST /api/admin/pumps
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "name": "Mumbai Central Pump",
  "code": "MUM001",
  "managerId": "65a1b2c3d4e5f6g7h8i9j0k1",  // ← From Step 2
  "location": {
    "address": "456 Central Avenue",
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
  "message": "Pump created successfully",
  "data": {
    "_id": "65b2c3d4e5f6g7h8i9j0k1l2",
    "name": "Mumbai Central Pump",
    "code": "MUM001",
    "managerId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "status": "active"
  }
}
```

#### 4. (Optional) Update Manager Later
```http
PATCH /api/admin/pumps/65b2c3d4e5f6g7h8i9j0k1l2
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "managerId": "65a1b2c3d4e5f6g7h8i9j0k2"  // ← Different manager
}
```

---

## Manager ID Format

**Valid Manager ID:**
- MongoDB ObjectId format: 24 hexadecimal characters
- Example: `"507f1f77bcf86cd799439011"`
- Must be a valid ObjectId that exists in the database with `role: "manager"`

**Invalid Manager ID:**
- ❌ `"123"` (too short)
- ❌ `"manager-name"` (not ObjectId format)
- ❌ `"507f1f77bcf86cd799439011x"` (too long)
- ❌ `"507f1f77bcf86cd79943901g"` (invalid hex character 'g')

**Empty/No Manager:**
- ✅ `"managerId": ""` (empty string - converted to null)
- ✅ `"managerId": null` (explicit null)
- ✅ Omit `managerId` field (defaults to null)

---

## Common Use Cases

### Use Case 1: Create Pump Without Manager (Assign Later)
```json
{
  "name": "New Pump",
  "code": "PMP002",
  "location": {...}
  // managerId not included - will be null
}
```

### Use Case 2: Create Pump with Manager
```json
{
  "name": "New Pump",
  "code": "PMP002",
  "managerId": "507f1f77bcf86cd799439011",
  "location": {...}
}
```

### Use Case 3: Remove Manager from Pump
```json
{
  "managerId": ""  // Empty string removes manager
}
```

### Use Case 4: Change Manager
```json
{
  "managerId": "507f1f77bcf86cd799439012"  // New manager ID
}
```

---

## Error Handling

### Error: Invalid Manager ID Format
```json
{
  "success": false,
  "message": "\"managerId\" must be a valid MongoDB ObjectId",
  "data": null
}
```
**Solution:** Ensure managerId is exactly 24 hexadecimal characters.

### Error: Manager Not Found
If you provide a valid ObjectId format but the user doesn't exist or isn't a manager, the pump will still be created, but the managerId won't be valid. Always verify the manager exists using `GET /api/admin/users?role=manager` first.

### Error: Manager Already Assigned to Another Pump
Currently, there's no validation preventing a manager from being assigned to multiple pumps. A manager can manage multiple pumps.

---

## Quick Reference

| Action | Endpoint | Method | managerId Value |
|--------|----------|--------|----------------|
| **Get Managers** | `/api/admin/users?role=manager` | GET | N/A |
| **Create Pump (with manager)** | `/api/admin/pumps` | POST | `"507f1f77bcf86cd799439011"` |
| **Create Pump (no manager)** | `/api/admin/pumps` | POST | `""` or omit |
| **Update Manager** | `/api/admin/pumps/:pumpId` | PATCH | `"507f1f77bcf86cd799439012"` |
| **Remove Manager** | `/api/admin/pumps/:pumpId` | PATCH | `""` or `null` |

---

## Frontend Integration Example

### React/JavaScript Example

```javascript
// Step 1: Get managers
async function getManagers(accessToken) {
  const response = await fetch('/api/admin/users?role=manager&limit=100', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const data = await response.json();
  return data.data.list; // Array of managers
}

// Step 2: Create pump with selected manager
async function createPump(accessToken, pumpData, managerId) {
  const response = await fetch('/api/admin/pumps', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...pumpData,
      managerId: managerId || null // Use selected manager or null
    })
  });
  return await response.json();
}

// Usage
const managers = await getManagers(adminToken);
const selectedManager = managers[0]; // User selects from dropdown
const pump = await createPump(adminToken, {
  name: "New Pump",
  code: "PMP003",
  location: {...}
}, selectedManager._id);
```

---

## Summary

1. **Get Managers:** Use `GET /api/admin/users?role=manager` to get list of all managers
2. **Copy Manager ID:** Use the `_id` field from the manager object
3. **Create/Update Pump:** Include `managerId` in the request body (or leave empty/null for no manager)
4. **Validation:** ManagerId must be a valid 24-character MongoDB ObjectId or empty string/null

---

**Last Updated:** February 19, 2026
