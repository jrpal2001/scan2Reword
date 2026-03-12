# Stats API – Query Guide (Admin & Manager)

This guide explains how to use the **Review Statistics** and **User Registration Graph** APIs, including all supported query parameters, formats, and behavior for **Admin** and **Manager** roles.

---

## Base URLs

| Role   | Base path (prefix with your API base, e.g. `/api/admin` or `/api/manager`) |
|--------|-----------------------------------------------------------------------------|
| Admin  | `/api/admin/stats/...`                                                      |
| Manager| `/api/manager/stats/...`                                                    |

Both roles use the same query parameters. **Manager** results are automatically scoped to their assigned pump(s).

**Authentication:** All requests require a valid JWT (Bearer token or cookie as per your auth setup).

---

## 1. Review Statistics

**Endpoint:** `GET /stats/review`

Returns a list of transactions (no attachments) plus aggregated totals (amount, liters, points generated/redeemed, and staff/manager breakdown). No pagination; list is capped internally.

### Query parameters

| Parameter   | Type   | Required | Description |
|------------|--------|----------|-------------|
| `startDate`| date   | No       | Start of date range (inclusive). ISO date, e.g. `2025-03-01`. |
| `endDate`  | date   | No       | End of date range (inclusive). ISO date, e.g. `2025-03-31`. |
| `month`    | number | No       | Month (1–12). Use together with `year`. |
| `year`     | number | No       | Year (2000–2100). Can be used alone (full year) or with `month`. |
| `startTime`| string | No       | Start time of day in **IST**. Format: `HH:mm` or `HH:mm:ss`, e.g. `09:00`, `14:30:00`. |
| `endTime`  | string | No       | End time of day in **IST**. Format: `HH:mm` or `HH:mm:ss`, e.g. `18:00`, `23:59`. |
| `pumpId`   | string | No       | Filter by a single pump (24-character hex MongoDB ObjectId). **Admin only**; Manager is already scoped to their pumps. |
| `userId`   | string | No       | Filter by a single user (24-character hex MongoDB ObjectId). |
| `fuelType` | string | No       | Filter by fuel type (Fuel transactions only): `Petrol`, `Diesel`, or `CNG`. |

**Default when no date filter is sent:**  
Current month in **IST** (Indian Standard Time) is used.

**Date/time rules:**

- If you send **only** `startDate` and/or `endDate` → filter by that date range (times default to 00:00:00–23:59:59 on those days in IST).
- If you send **only** `year` (no `month`) → full calendar year.
- If you send **`year` + `month`** → that calendar month.
- `startTime` / `endTime` restrict results to that time window **within the chosen date range**, interpreted in IST.

### Example requests

**Current month (default):**
```http
GET /api/admin/stats/review
```

**Specific date range:**
```http
GET /api/admin/stats/review?startDate=2025-03-01&endDate=2025-03-31
```

**Specific month by number:**
```http
GET /api/admin/stats/review?month=3&year=2025
```

**Full year:**
```http
GET /api/admin/stats/review?year=2025
```

**Date range + time window (e.g. 9 AM – 6 PM IST):**
```http
GET /api/admin/stats/review?startDate=2025-03-01&endDate=2025-03-31&startTime=09:00&endTime=18:00
```

**Filter by pump (Admin):**
```http
GET /api/admin/stats/review?month=3&year=2025&pumpId=507f1f77bcf86cd799439011
```

**Filter by user:**
```http
GET /api/admin/stats/review?month=3&year=2025&userId=507f1f77bcf86cd799439012
```

**Filter by fuel type (Petrol, Diesel, CNG):**
```http
GET /api/admin/stats/review?month=3&year=2025&fuelType=Petrol
```

### Response shape (summary)

- `list`: array of transaction objects (no `attachments`), each with `createdAtIST` when applicable.
- `totalAmount`, `totalLiters`, `totalPointsGenerated`, `totalPointsRedeemed`
- `totalPointsGeneratedByStaffManager`, `totalPointsRedeemedByStaffManager`

---

## 2. User Registration Graph

**Endpoint:** `GET /stats/user-registrations`

Returns user registration data: list of users, total count, breakdown by period (day or month), and referral stats (points earned, signups). No time-of-day filters; only date range.

### Query parameters

| Parameter   | Type   | Required | Description |
|------------|--------|----------|-------------|
| `startDate`| date   | No       | Start of date range (inclusive). ISO date. |
| `endDate`  | date   | No       | End of date range (inclusive). ISO date. |
| `month`    | number | No       | Month (1–12). Use with `year`. |
| `year`     | number | No       | Year (2000–2100). Alone = full year; with `month` = that month. |
| `groupBy`  | string | No       | How to group the graph: `day` or `month`. Default: `day`. |

**Default when no date filter is sent:**  
Current month in **IST** is used.

### Example requests

**Current month, grouped by day (default):**
```http
GET /api/admin/stats/user-registrations
```

**Current month, grouped by month:**
```http
GET /api/admin/stats/user-registrations?groupBy=month
```

**Specific date range, by day:**
```http
GET /api/admin/stats/user-registrations?startDate=2025-03-01&endDate=2025-03-31&groupBy=day
```

**Specific month:**
```http
GET /api/admin/stats/user-registrations?month=3&year=2025
```

**Full year, by month:**
```http
GET /api/admin/stats/user-registrations?year=2025&groupBy=month
```

### Response shape (summary)

- `list`: array of user objects (with `createdAtIST` when applicable).
- `totalRegistrations`: total count in the filtered range.
- `byPeriod`: array of `{ period, count }` (or similar) for the graph, according to `groupBy`.
- `totalReferralPointsEarned`, `totalReferralSignups`: referral metrics (Admin = all; Manager = only referrals by that manager and their staff).

---

## Role differences

| Aspect | Admin | Manager |
|--------|--------|---------|
| **Pumps** | Sees all pumps; can optionally filter by `pumpId` on review stats. | Automatically restricted to assigned pump(s). `pumpId` can further narrow within that set. |
| **Review stats** | All transactions in scope. | Only transactions for their pump(s). |
| **User registrations** | All users; referral stats across all referrers. | Only users registered at their pump(s); referral stats only for the manager and their assigned staff. |

---

## Date and time formats (quick reference)

- **Dates:** ISO date string, e.g. `2025-03-01`, or values that `new Date(...)` accepts.
- **Time of day (review only):** IST, `HH:mm` or `HH:mm:ss` (e.g. `09:00`, `18:30:00`).
- **Month:** integer 1–12.
- **Year:** integer 2000–2100.
- **IDs:** 24-character hex string (MongoDB ObjectId).

Use this guide when calling the stats APIs from the admin or manager dashboard or any API client.
