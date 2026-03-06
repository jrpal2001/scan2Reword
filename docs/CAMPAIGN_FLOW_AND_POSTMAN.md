# Campaign Flow – How It Works & Postman Testing (Admin & Manager)

## 1. How the Campaign Flow Works

### 1.1 What campaigns do

Campaigns change how **points** are calculated when a **transaction** is created:

- **Base points** come from SystemConfig (e.g. 1 point per liter for Fuel).
- If an **active** campaign matches the transaction (pump, category, amount, dates), the first matching campaign is applied:
  - **multiplier** → `finalPoints = basePoints × multiplier`
  - **bonusPoints** → `finalPoints = basePoints + bonusPoints`
  - **bonusPercentage** → `finalPoints = basePoints + (basePoints × bonusPercentage / 100)`
- The transaction is saved with `pointsEarned = finalPoints` and optional `campaignId`. The user’s wallet is credited with `pointsEarned`.

So: **create/update campaigns → set status to `active` → when staff creates a transaction at a matching pump, the campaign is auto-applied and extra points are given.**

---

### 1.2 Campaign model (summary)

| Field | Description |
|-------|-------------|
| **name** | Campaign name |
| **type** | `multiplier` \| `bonusPoints` \| `bonusPercentage` |
| **multiplier** | Required if type = `multiplier` (e.g. 2 = double points) |
| **bonusPoints** | Required if type = `bonusPoints` (e.g. 10 extra points) |
| **bonusPercentage** | Required if type = `bonusPercentage` (e.g. 20 = +20%) |
| **startDate** / **endDate** | Campaign is “active” only when `now` is between these (inclusive) |
| **conditions** | Optional: `minAmount`, `minliters` (min fuel liters for campaign to apply), `categories` (Fuel/Lubricant/Store/Service), `userSegment`, `frequencyLimit` |
| **pumpIds** | Pumps where campaign applies. **Empty array `[]` (or omit) = all pumps** (Admin only). **Specific array** = campaign applies only at those pump IDs. Manager must set at least one pump. |
| **status** | `draft` \| `active` \| `paused` \| `expired` \| `cancelled` – only **active** campaigns are used at transaction time |
| **createdBy** / **createdByRole** | Set by backend (admin or manager) |

---

### 1.3 Who can do what

| Role | Create | List | Get by ID | Update | Delete | pumpIds |
|------|--------|------|------------|--------|--------|--------|
| **Admin** | ✅ | ✅ All campaigns | ✅ | ✅ | ✅ | Optional; empty = all pumps |
| **Manager** | ✅ | ✅ Only campaigns for their pumps (or created by them) | ✅ If campaign is for their pumps or they created it | ✅ Only campaigns they created | ✅ Only campaigns they created | **Required**; must be subset of their assigned pumps |

---

### 1.4 When a transaction uses a campaign

1. Staff/Manager/Admin creates a transaction: **POST /api/transactions** (or manager route) with `pumpId`, `category`, `amount`, etc.
2. Backend calls `campaignService.findActiveCampaignsForTransaction(pumpId, category, amount)`.
3. Repository finds campaigns where:
   - `status === 'active'`
   - `startDate <= now` and `endDate >= now`
   - Pump: `pumpIds` is empty (all pumps) or `pumpId` is in `pumpIds`
   - `conditions.minAmount` is satisfied (if set)
   - `conditions.minliters` is satisfied (if set): transaction liters ≥ minliters (e.g. Fuel); if user buys less than minliters, campaign does not apply
   - `conditions.categories` includes transaction category (if set)
4. **All** matching campaigns are applied in sequence (stacked). E.g. base points × Admin multiplier × Manager multiplier — so Admin 2× and Manager 1.5× on same pump gives base × 2 × 1.5. The transaction stores `campaignId` (first applied) and `campaignIds` (all applied). `finalPoints` is computed by applying each campaign in order.
---

## 2. API Endpoints (Admin vs Manager)

Base URL: `http://localhost:3000` (or your `PORT`).

| Action | Admin | Manager |
|--------|--------|--------|
| Create | `POST /api/admin/campaigns` | `POST /api/manager/campaigns` |
| List | `GET /api/admin/campaigns` | `GET /api/manager/campaigns` |
| Get one | `GET /api/admin/campaigns/:campaignId` | `GET /api/manager/campaigns/:campaignId` |
| Update | `PATCH /api/admin/campaigns/:campaignId` | `PATCH /api/manager/campaigns/:campaignId` |
| Delete | `DELETE /api/admin/campaigns/:campaignId` | `DELETE /api/manager/campaigns/:campaignId` |

All require **Bearer token** in header:  
`Authorization: Bearer <access_token>`.

---

## 3. Postman Testing – Admin

### Step 1: Get Admin token

- **POST** `http://localhost:3000/api/auth/login`  
  Body (JSON): `{ "identifier": "admin@gmail.com" }`  
  (use your Admin email)
- **POST** `http://localhost:3000/api/auth/verify-password`  
  Body (JSON): `{ "identifier": "admin@gmail.com", "password": "admin123" }`  
  Copy `token` from the response.

---

### Step 2: Create campaign (Admin)

- **Method:** POST  
- **URL:** `http://localhost:3000/api/admin/campaigns`  
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <paste_admin_token>`
- **Body (raw JSON)** – example **multiplier** (double points):

```json
{
  "name": "Double Points Weekend",
  "type": "multiplier",
  "multiplier": 2,
  "startDate": "2025-02-01T00:00:00.000Z",
  "endDate": "2025-12-31T23:59:59.000Z",
  "conditions": {
    "minAmount": 100,
    "minliters": 10,
    "categories": ["Fuel"]
  },
  "pumpIds": [],
  "status": "active"
}
```

- **pumpIds quick reference:**
  - **All pumps (Admin only):** `"pumpIds": []` or omit the field — campaign applies at every pump.
  - **Specific pumps:** `"pumpIds": ["<pumpObjectId1>", "<pumpObjectId2>"]` — campaign applies only when a transaction is at one of these pumps.
  - **Manager:** must always send at least one pump ID; empty array is not allowed.
- **status**: `draft` | `active` | `paused` | `expired` | `cancelled`. Use `active` to apply at transaction time.

**Example – bonusPoints:**

```json
{
  "name": "Fuel Bonus 10",
  "type": "bonusPoints",
  "bonusPoints": 10,
  "startDate": "2025-02-01T00:00:00.000Z",
  "endDate": "2025-12-31T23:59:59.000Z",
  "conditions": { "categories": ["Fuel"] },
  "pumpIds": [],
  "status": "active"
}
```

**Example – bonusPercentage:**

```json
{
  "name": "Store 20% Extra",
  "type": "bonusPercentage",
  "bonusPercentage": 20,
  "startDate": "2025-02-01T00:00:00.000Z",
  "endDate": "2025-12-31T23:59:59.000Z",
  "conditions": { "categories": ["Store"] },
  "pumpIds": [],
  "status": "active"
}
```

- Save the returned `_id` for Get/Update/Delete.

---

### Step 3: List campaigns (Admin)

- **Method:** GET  
- **URL:** `http://localhost:3000/api/admin/campaigns`  
  Optional query: `?page=1&limit=10&status=active&pumpId=<pumpId>`  
- **Headers:** `Authorization: Bearer <admin_token>`

---

### Step 4: Get one campaign (Admin)

- **Method:** GET  
- **URL:** `http://localhost:3000/api/admin/campaigns/<campaignId>`  
- **Headers:** `Authorization: Bearer <admin_token>`

---

### Step 5: Update campaign (Admin)

- **Method:** PATCH  
- **URL:** `http://localhost:3000/api/admin/campaigns/<campaignId>`  
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <admin_token>`  
- **Body (partial):** e.g. change status or end date:

```json
{
  "status": "paused"
}
```

or

```json
{
  "endDate": "2025-06-30T23:59:59.000Z"
}
```

---

### Step 6: Delete campaign (Admin)

- **Method:** DELETE  
- **URL:** `http://localhost:3000/api/admin/campaigns/<campaignId>`  
- **Headers:** `Authorization: Bearer <admin_token>`

---

## 4. Postman Testing – Manager

### Step 1: Get Manager token

- **POST** `http://localhost:3000/api/auth/verify-password`  
  Body (JSON): `{ "identifier": "<manager_email_or_phone_or_code>", "password": "<manager_password>" }`  
  Copy `token` from the response.

Manager’s **allowed pumps** are determined by their staff assignment; `attachPumpScope` sets `req.allowedPumpIds`.

---

### Step 2: Create campaign (Manager)

- **Method:** POST  
- **URL:** `http://localhost:3000/api/manager/campaigns`  
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <manager_token>`  
- **Body (raw JSON):**

Manager **must** send at least one pump (from their assigned pumps). Example:

```json
{
  "name": "Manager Pump Double Points",
  "type": "multiplier",
  "multiplier": 2,
  "startDate": "2025-02-01T00:00:00.000Z",
  "endDate": "2025-12-31T23:59:59.000Z",
  "conditions": { "categories": ["Fuel"], "minAmount": 50 },
  "pumpIds": ["<manager_assigned_pump_id_1>"],
  "status": "active"
}
```

- Replace `<manager_assigned_pump_id_1>` with a real pump ID that this manager is assigned to (e.g. from **GET /api/manager/dashboard** → `assignedPumps[]._id`).
- If you send a pumpId the manager is not assigned to → **403 Access denied to one or more pumps**.
- If you send `"pumpIds": []` → **400 Manager must assign campaign to at least one pump**.

---

### Step 3: List campaigns (Manager)

- **Method:** GET  
- **URL:** `http://localhost:3000/api/manager/campaigns`  
  Optional: `?page=1&limit=10&status=active&pumpId=<pumpId>`  
- **Headers:** `Authorization: Bearer <manager_token>`

Returns only campaigns that:
- Apply to all pumps (`pumpIds` empty), or
- Include at least one of the manager’s assigned pumps, or
- Were created by this manager.

---

### Step 4: Get one campaign (Manager)

- **Method:** GET  
- **URL:** `http://localhost:3000/api/manager/campaigns/<campaignId>`  
- **Headers:** `Authorization: Bearer <manager_token>`

Manager can only get campaigns they have access to (their pumps or created by them).

---

### Step 5: Update campaign (Manager)

- **Method:** PATCH  
- **URL:** `http://localhost:3000/api/manager/campaigns/<campaignId>`  
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <manager_token>`  
- **Body:** Same as Admin (e.g. `{ "status": "paused" }`).

Manager can update **only campaigns they created** (`createdBy = managerId`). Otherwise → **403 Access denied to this campaign**. If they update `pumpIds`, all IDs must be in their assigned pumps.

---

### Step 6: Delete campaign (Manager)

- **Method:** DELETE  
- **URL:** `http://localhost:3000/api/manager/campaigns/<campaignId>`  
- **Headers:** `Authorization: Bearer <manager_token>`

Manager can delete **only campaigns they created**.

---

## 5. Testing that a campaign is applied (transaction flow)

1. Create an **active** campaign for a pump (and category/amount if you set conditions), e.g. multiplier 2 for Fuel at that pump.
2. Create a transaction for that pump and category:
   - **POST /api/transactions** (Admin/Manager) or staff flow with that pump.
   - Body must include: `pumpId`, `identifier` (loyaltyId or user), `amount`, `liters` (for Fuel), `category: "Fuel"`, etc., as per your transaction API.
3. In the response, check:
   - `pointsEarned` = base points × multiplier (or + bonus), and
   - `campaignId` = the campaign’s `_id` (if stored on the transaction model).

That confirms the campaign flow is working end-to-end.

---

## 6. Quick reference

| Item | Value |
|------|--------|
| Campaign types | `multiplier`, `bonusPoints`, `bonusPercentage` |
| Status for transaction use | `active` |
| Admin pumpIds | `[]` = all pumps, or list of pump ObjectIds |
| Manager pumpIds | **Required**; must be subset of assigned pumps |
| Date format | ISO 8601, e.g. `2025-02-01T00:00:00.000Z` |
| Categories in conditions | `Fuel`, `Lubricant`, `Store`, `Service` |
| conditions.minliters | Min fuel liters for campaign to apply; transaction must have liters ≥ this (Fuel only) |
