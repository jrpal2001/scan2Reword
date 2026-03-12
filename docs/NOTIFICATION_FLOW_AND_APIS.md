# Notification System – How It Works & APIs

This document explains how notifications work, which APIs to use for FCM token and viewing/deleting, and that **delete is per user only** (not global).

---

## 1. How notifications work

- **Push (FCM):** Admin can send a message to the Firebase topic `all`. Any device that has subscribed to `all` (via its FCM token) receives the push.
- **In-app list:** Notifications are stored with `users`, `managerIds`, and `staffIds`. **Send to all** creates one document with all active user, manager, and staff IDs; each role sees “My notifications” where their ID is in the matching array. **Send to specific users** uses only `users` (and FCM to those users’ tokens).
- **Recipients:** User, Manager, and Staff can all register FCM token (`POST /api/notifications/subscribeToken`), view **my** notifications (`GET /api/notifications/my`), and delete a notification for themselves only (`DELETE /api/notifications/my`). The backend uses the JWT’s role (user / manager / staff) to read/update the correct array.
- **Delete:** Deleting “my” notification only removes the current recipient from the relevant array (users, managerIds, or staffIds). It does **not** delete the notification for others.

---

## 2. API to add (register) FCM token

**Endpoint:** `POST /api/notifications/subscribeToken`  
**Auth:** Required (JWT – user must be logged in).

**Request body (JSON):**
```json
{
  "token": "<FCM device token string>"
}
```

**What it does:**
- Appends the token to the current **user’s / manager’s / staff’s / admin’s** `FcmTokens` (based on JWT role). Works for User, Manager, Staff, and **Admin**.
- Subscribes the token to Firebase topic: **`all`** for User/Manager/Staff, **`admin`** for Admin. When a manager/staff creates a redemption request, the backend sends an in-app notification and FCM to topic `admin`, so admin devices that subscribed receive the push.

**Success response:** `{ "success": true, "message": "Token subscribed successfully", "data": { "success": true } }`

Use this API when the app gets an FCM token (e.g. on login or when Firebase returns a token) so that:
1. The backend knows which devices belong to the user.
2. The device receives push when admin sends to all.

---

## 3. API to view (list) notifications

**Endpoint:** `GET /api/notifications/my`  
**Auth:** Required (JWT).

**Query (optional):**
- `page` – default 1  
- `limit` – default 10  

**Example:** `GET /api/notifications/my?page=1&limit=20`

**What it does:** Returns notifications where the current **user / manager / staff** is in the notification’s `users`, `managerIds`, or `staffIds` (based on JWT role). Paginated.

**Response:** Paginated list: `data` = array of notification objects, `meta` = `{ total, page, limit, totalPages }`. Each item has e.g. `title`, `body`, `link`, `img`, `notificationTime`, `createdAt`, etc.

---

## 4. API to delete a notification (for current user only)

**Endpoint:** `DELETE /api/notifications/my`  
**Auth:** Required (JWT).

**Request body (JSON):**
```json
{
  "notificationId": "<24-char hex MongoDB _id of the notification>"
}
```

**What it does:** Removes the **current user / manager / staff** from that notification’s `users`, `managerIds`, or `staffIds` (based on JWT). The notification is **not** deleted globally; others still see it.

So when admin sends to all and a user deletes it, the effect is “delete for this user only”, not “delete for everyone”.

**Success response:** `{ "success": true, "message": "Notification deleted successfully", "data": null }`  
**Errors:** 404 if notification doesn’t exist or current user is not in its `users` list.

---

## 5. Admin APIs (send notifications)

| Endpoint | Purpose |
|----------|--------|
| `POST /api/notifications/all` | Send to **all** users, managers, and staff (FCM topic `all` + one doc with `users`, `managerIds`, `staffIds`). Body: `{ title, body, link?, img? }`. |
| `POST /api/notifications/` | Send to **specific users**. Body: `{ userIds: ["id1","id2"], title, body, link?, img? }`. |
| `GET /api/admin/notifications` | **Admin:** List admin-only notifications (e.g. new redemption requests). Query: `page`, `limit`. |

Both require Admin JWT.

---

## 6. Summary

| Action | API | Auth |
|--------|-----|------|
| Add FCM token | `POST /api/notifications/subscribeToken` body `{ token }` | User / Manager / Staff / **Admin** JWT |
| View my notifications | `GET /api/notifications/my?page=1&limit=10` | User / Manager / Staff JWT |
| Delete a notification (for me only) | `DELETE /api/notifications/my` body `{ notificationId }` | User / Manager / Staff JWT |
| Send to all | `POST /api/notifications/all` | Admin |
| Send to specific users | `POST /api/notifications/` | Admin |
| Admin list notifications | `GET /api/admin/notifications?page=1&limit=20` | Admin |

Delete is **per recipient**: removing a notification from “my” list does not remove it for other users/managers/staff.

---

## 7. Redemption-related notifications

- **Manager/Staff creates redemption (at pump):** An in-app notification with `forAdmin: true` is created. Admin sees it in `GET /api/admin/notifications` (e.g. “New redemption request – Redemption of X points (code: RED…) is pending approval”).
- **Admin approves redemption:** In-app notifications are created for the creator, user, and owner (if driver). The **body includes the redeemer’s name, loyalty ID, and phone**, e.g. “Redemption of X points (code: RED…) has been approved. Name: …, Loyalty ID: …, Phone: ….”

---

## 8. Redemption flow: Manager creates → Admin approves → Manager sees status

**Manager (or Staff) creates a redemption at pump**

- **API:** `POST /api/manager/redeem` (Manager) or `POST /api/redeem/at-pump` (Manager/Staff with `pumpId` in body).
- **Body:** `{ "identifier": "<loyaltyId or mobile>", "pointsToDeduct": 100, "pumpId": "<pumpId>" }`. For Staff assigned to a single pump, `pumpId` can be omitted (backend uses their assigned pump).
- **Result:** Redemption is created with `status: "pending"`. Points are **not** deducted yet. Admin gets an in-app notification (see §7).

**Admin approves (or rejects)**

- **Approve:** `POST /api/admin/redemptions/:id/approve` (Admin JWT). Points are deducted; Manager/Staff (creator), User, and Owner (if driver) get in-app notifications.
- **Reject:** `POST /api/admin/redemptions/:id/reject` with body `{ "reason": "..." }`. Points are refunded (if any were held); no approval notification.

**Manager (or Staff) sees redemptions they created**

- **API:** `GET /api/redeem?page=1&limit=10&status=pending` (or no status for all). When the requester is Manager or Staff, the backend **filters by `createdBy` + `createdByModel`**, so the list contains only redemptions created by that manager or staff.
- **Optional query:** `status` = `pending` | `approved` | `rejected` | `used` to filter by status.
- Manager/Staff use the same list endpoint as users; the backend applies the creator filter automatically based on JWT role.
- Each redemption in the list includes **`userDisplay`**: `{ fullName, loyaltyId, mobile }` for the redeemer (userId), so the UI can show user name, loyalty ID, and phone without extra lookups.
