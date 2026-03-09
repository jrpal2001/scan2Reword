# Banner – User Flow & How It Works

This document describes **how end-users (customers) see and use banners** and how the flow works from app integration to display.

---

## 1. What Are Banners (User Perspective)

Banners are **promotional content** shown in the app:

- **Title** and **description** – short text
- **Image** (`imageUrl`) – visual (e.g. offer image)
- **Link** (`linkUrl`) – optional; when the user taps the banner, the app can open this URL (offer page, web view, deep link, etc.)

They are **time-bound**: each banner has a start and end time. Only banners that are **active** in the current time window are returned to the user.

---

## 2. How the User Uses Banners

| Step | What happens |
|------|----------------|
| 1 | User opens the app (e.g. home screen, or pump/station screen). |
| 2 | App calls the **public** API to get active banners (no login required). |
| 3 | Backend returns only banners that are **active now** (within start/end time) and, if the app sent a pump ID, only banners for that pump or global. |
| 4 | App shows banners (e.g. carousel or list) using `title`, `description`, `imageUrl`. |
| 5 | If the user **taps** a banner and it has a `linkUrl`, the app opens that URL (in-app browser or external). |

So: **user does not “create” or “manage” banners** – they only **view** and **tap** them. Creation and management are done by Admin/Manager via their own APIs.

---

## 3. Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ADMIN / MANAGER (Back office)                                           │
│  • Create banner: title, description, imageUrl, linkUrl, start/end time  │
│  • Set pumpIds: [] = all pumps, or [pumpId1, pumpId2] = specific pumps   │
│  • List / Update / Delete banners                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BANNER STORED IN DB                                                     │
│  status: active | expired, startTime, endTime, pumpIds, imageUrl, etc.  │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MOBILE / WEB APP (User side)                                            │
│  1. Call GET /api/banners?pumpId=... (optional pumpId)                   │
│  2. Receive only banners where:                                          │
│       • status = active                                                  │
│       • startTime ≤ now < endTime                                        │
│       • If pumpId sent: banner is global (pumpIds []) OR for that pump   │
│  3. Render banners (image, title, description)                           │
│  4. On tap → open linkUrl if present                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Public API for the App (User Flow)

### Endpoint

**GET `/api/banners`**

- **Auth:** None (public).
- **Query:**
  - `pumpId` (optional) – if the user is on a specific pump/station screen, send this to get banners for that pump + global banners.

### When to Send `pumpId`

| Screen / Context | Use `pumpId`? | Effect |
|------------------|----------------|--------|
| Home / general   | No             | App gets **all active banners** (global + any pump-specific). |
| Pump / station   | Yes (that pump’s ID) | App gets only **global banners** and **banners for that pump**. |

So the **same endpoint** serves both “show everything” and “show for this pump” by including or omitting `pumpId`.

### Response Shape

```json
{
  "success": true,
  "message": "Active banners retrieved",
  "data": [
    {
      "_id": "...",
      "title": "Weekend Fuel Offer",
      "description": "Save more this weekend",
      "imageUrl": "https://...",
      "linkUrl": "https://...",
      "startTime": "2025-03-01T00:00:00.000Z",
      "endTime": "2025-03-07T23:59:59.000Z",
      "createdAt": "...",
      "updatedAt": "...",
      "createdAtIST": "...",
      "updatedAtIST": "..."
    }
  ],
  "meta": null
}
```

- `data` is an **array** of banners (may be empty if none are active).
- App uses `title`, `description`, `imageUrl` to render; uses `linkUrl` when the user taps the banner.

---

## 5. Step-by-Step User Flow (App Integration)

### 5.1 Fetching Banners

1. When the user lands on a screen where banners should show (e.g. home or pump screen), the app calls:
   - **Home:** `GET /api/banners`
   - **Pump screen:** `GET /api/banners?pumpId=<currentPumpId>`
2. Backend:
   - Finds banners with `status = 'active'`, `startTime ≤ now`, `endTime > now`.
   - If `pumpId` is present: keeps only banners that are global (`pumpIds` empty) or include that `pumpId`.
   - Returns them sorted by `createdAt` (newest first).
3. App stores the list (or uses it directly) and renders each banner (e.g. carousel or list).

### 5.2 Displaying a Banner

For each item in `data`:

- Show **image:** use `imageUrl` (or placeholder if missing).
- Show **title:** `title`.
- Show **description:** `description` (optional, can be smaller text or tooltip).
- If `linkUrl` is present, make the banner **tappable**.

### 5.3 When User Taps a Banner

- If `linkUrl` exists: open it (in-app WebView or system browser).
- If no `linkUrl`: do nothing or show a detail screen with title/description only.

---

## 6. Backend Rules (What the User Effectively Gets)

| Rule | Meaning for the user |
|------|----------------------|
| **Active only** | User never sees draft or expired banners; only those valid “right now”. |
| **Time window** | User sees a banner only between its `startTime` and `endTime`. |
| **Global vs pump** | With `pumpId`, user sees global offers + offers for that pump. Without `pumpId`, user sees all active banners. |
| **No auth** | Banner listing does not require login; any app can call it for a public carousel. |

---

## 7. Example Usage (App Side)

```text
# User on home screen – show all active banners
GET /api/banners

# User on pump "69a03e0efe9553a49e7adb21" – show global + that pump’s banners
GET /api/banners?pumpId=69a03e0efe9553a49e7adb21
```

App then:

1. Parses `data` array.
2. Renders each banner (image + title + description).
3. On tap → open `linkUrl` if present.

---

## 8. Summary

- **User** only **views** and **taps** banners; they do not create or manage them.
- **App** uses the **public GET `/api/banners`** endpoint (with optional `pumpId`) to get active banners and displays them using `title`, `description`, `imageUrl`, and `linkUrl`.
- **Flow:** Admin/Manager create and schedule banners → backend stores them → app fetches active ones → user sees and optionally taps to open `linkUrl`.
