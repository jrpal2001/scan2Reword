# Project Updates – User Types, Owner-Only, Points, Redemption, Wallet

## 1. User model: `userType`

In `User` (UserLoyalty) model, a new field **`userType`** distinguishes:

- **`individual`** – Single user (no fleet), `ownerId` is null.
- **`owner`** – Fleet owner, `ownerId` is null, has `loyaltyId` (owner loyalty ID).
- **`driver`** – Fleet driver, `ownerId` points to the fleet owner.

Set automatically on create in all flows (register, admin, manager/staff, owner addVehicle). Use in UI/APIs to show the right screens and permissions.

---

## 2. Owner-only registration (no vehicle, no driver)

You can create **only a fleet owner** (no driver, no vehicle) in all four flows.

| API | Body |
|-----|------|
| **POST /api/auth/register** | `accountType: "organization"`, `ownerType: "non-registered"`, `owner: { fullName, mobile, email?, address? }`, **`ownerOnly: true`**. No `vehicle`. |
| **POST /api/admin/users** | `role: "user"`, `accountType: "organization"`, `ownerType: "non-registered"`, `owner: { ... }`, **`ownerOnly: true`**. No `vehicle`. |
| **POST /api/manager/users** | Same as admin with **`ownerOnly: true`**. |
| **POST /api/staff/users** | Same with **`ownerOnly: true`**. |

Response: one user (the owner) with `userType: "owner"`, `loyaltyId`, no vehicle.

---

## 3. No points expiry

- Points **do not expire**.
- `creditPoints` no longer sets an expiry date (ledger `expiryDate` is null).
- Points expiry cron jobs are **disabled** (no daily expiry, no expiry notifications).
- Wallet still has `expiredPoints` for backward compatibility but it is not used.

---

## 4. Manager and staff – multiple pumps

- **Staff:** Can be assigned to **multiple pumps** via multiple `POST /api/admin/staff-assignments` (or manager assign) with different `pumpId`. One assignment per (staff, pump) pair.
- **Manager:** A pump has one `managerId`; a manager can be linked to **many pumps** (each pump stores that manager’s ID). No change required.

---

## 5. Redemption: admin direct vs manager/staff (approval)

- **Admin – direct redeem**  
  **POST /api/admin/redemptions/direct**  
  Body: `{ "userId": "<user-_id>", "pointsToDeduct": <number> }`  
  Creates a redemption and **deducts points immediately** (no approval).

- **Manager/Staff – at-pump redemption**  
  **POST /api/manager/redeem** or **POST /api/staff/redeem**  
  Body: `{ "identifier": "<loyaltyId|mobile|userId>", "pointsToDeduct": <number>, "pumpId": "<pump-_id>" }`  
  Creates a redemption with status **PENDING**. Points are **not** deducted yet.

- **Admin – approve pending redemption**  
  **POST /api/admin/redemptions/:id/approve**  
  Deducts points from the user and sets redemption status to **APPROVED**.

- **Admin – reject pending redemption**  
  **POST /api/admin/redemptions/:id/reject**  
  Body: `{ "reason": "..." }`  
  Does not deduct points; redemption status set to **REJECTED**.

---

## 6. Wallet visibility: driver vs owner

- **Driver** (`userType: "driver"`) or **individual**  
  **GET /api/user/:userId/wallet** (own `userId` only)  
  Returns **only that user’s wallet** (summary + ledger). A driver cannot see other users’ balances.

- **Owner** (`userType: "owner"`)  
  **GET /api/user/:userId/wallet** (own `userId`)  
  Returns **own wallet** plus **`fleetSummary`**: array of all drivers under this owner, each with `userId`, `fullName`, `mobile`, `walletSummary`. So only the fleet owner sees all vehicles/users points.

Admin/Manager/Staff can still call the same endpoint with any `userId` to view any user’s wallet (and for owners, fleet summary is included).

---

## 7. Summary table

| Feature | Detail |
|--------|--------|
| **userType** | `individual` \| `owner` \| `driver` on User model, set on create. |
| **Owner-only** | `ownerOnly: true` in register, admin, manager, staff create (org + non-registered owner, no vehicle). |
| **Points expiry** | Disabled; no expiry date, no expiry cron. |
| **Multiple pumps** | Staff: multiple staff-assignments; Manager: multiple pumps per manager. |
| **Redemption** | Admin: direct redeem (deduct at once); Manager/Staff: PENDING → Admin approve (deduct on approve) or reject. |
| **Wallet** | Driver: own only; Owner: own + fleetSummary (all drivers’ points). |
