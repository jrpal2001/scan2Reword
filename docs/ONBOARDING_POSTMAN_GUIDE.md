# Testing Onboarding APIs in Postman

Base URL: `http://localhost:<PORT>` (or your backend URL). Admin routes use prefix `/api/admin`, public uses `/api`.

---

## 1. Get Admin Token (required for admin APIs)

**Request:** `POST {{baseUrl}}/api/admin/login`  
**Body:** raw JSON

```json
{
  "phone": "your_admin_phone",
  "password": "your_admin_password"
}
```

**Response:** Copy `data.accessToken` (or `data.token`) and use it in admin requests.

In Postman: **Authorization** tab → Type: **Bearer Token** → paste the token.  
Or add header: `Authorization: Bearer <your_token>`.

---

## 2. Create Onboarding (multipart – multiple images)

**Request:** `POST {{baseUrl}}/api/admin/onboarding`  
**Auth:** Bearer Token (admin)

**Body:**
- Type: **form-data** (not raw JSON).
- Add key **`images`**.
- Change type of `images` from "Text" to **"File"** (dropdown on the right).
- Click "Select Files" and choose **one or more image files** (max 10).  
  To add more than one file, add another row with the **same key** `images` and type **File**, and select another file.  
  (Some Postman versions allow multiple files under one key "images"; if not, add multiple rows with key `images`.)

**Do not** send any JSON body. Only the `images` field(s) as file(s).

**Expected:** `201 Created`. Response `data` is the created document with `onboardImage: [url1, url2, ...]`, `_id`, `createdAt`, etc.

---

## 3. List Onboarding (admin, paginated)

**Request:** `GET {{baseUrl}}/api/admin/onboarding`  
**Auth:** Bearer Token (admin)

**Query params (optional):**
| Key   | Example | Description        |
|-------|---------|--------------------|
| `page`| `1`     | Page number        |
| `limit` | `20` | Items per page     |

Example: `GET {{baseUrl}}/api/admin/onboarding?page=1&limit=10`

**Expected:** `200 OK`. Paginated list with `data.list` (array of onboarding docs with `onboardImage`, `_id`, `createdAt`, etc.) and `meta` (total, page, limit, totalPages).

---

## 4. Get Onboarding by ID (admin)

**Request:** `GET {{baseUrl}}/api/admin/onboarding/{{onboardingId}}`  
**Auth:** Bearer Token (admin)

Replace `{{onboardingId}}` with an `_id` from the list (e.g. `69b28aa4f5ba78224b1c3f9a`).

**Expected:** `200 OK`. Single document with `onboardImage`, `_id`, `createdAt`, etc.

---

## 5. Update Onboarding (multipart – replace images)

**Request:** `PATCH {{baseUrl}}/api/admin/onboarding/{{onboardingId}}`  
**Auth:** Bearer Token (admin)

**Body:**
- Type: **form-data**.
- Add key **`images`**.
- Set type to **"File"** and select **one or more image files** (max 10).  
  Same as Create: multiple rows with key `images` if your Postman supports multiple files per key.

This **replaces** the document’s `onboardImage` array with the new image URLs.

**Expected:** `200 OK`. Updated document in `data` with new `onboardImage` array.

---

## 6. Delete Onboarding (admin)

**Request:** `DELETE {{baseUrl}}/api/admin/onboarding/{{onboardingId}}`  
**Auth:** Bearer Token (admin)

**Expected:** `200 OK`. Message like "Onboarding item deleted successfully".

---

## 7. Public List (no auth)

**Request:** `GET {{baseUrl}}/api/onboarding`  
**Auth:** None

**Query params (optional):**
| Key    | Example | Description        |
|--------|---------|--------------------|
| `limit`| `20`    | Max items (default 20, max 50) |

Example: `GET {{baseUrl}}/api/onboarding?limit=10`

**Expected:** `200 OK`. `data.list` = array of onboarding docs with `onboardImage`, `_id`, `createdAt`, etc. Sorted by `createdAt`.

---

## Quick reference

| Method | URL | Auth | Body / Params |
|--------|-----|------|----------------|
| POST   | `/api/admin/onboarding` | Admin Bearer | **form-data** key `images` (File), 1–10 files |
| GET    | `/api/admin/onboarding?page=1&limit=20` | Admin Bearer | Query: page, limit |
| GET    | `/api/admin/onboarding/:id` | Admin Bearer | Path: onboarding `_id` |
| PATCH  | `/api/admin/onboarding/:id` | Admin Bearer | **form-data** key `images` (File), 1–10 files |
| DELETE | `/api/admin/onboarding/:id` | Admin Bearer | Path: onboarding `_id` |
| GET    | `/api/onboarding?limit=20` | None | Query: limit (optional) |

---

## Postman: Adding multiple files for `images`

1. Body → **form-data**.
2. Key: `images` → type: **File** → Select one file.
3. To add more files: click "Add new row" (or duplicate row), key again `images`, type **File**, select another file.  
   Result: several rows with key `images`, each with a file. The backend receives them as an array and uploads all to S3, then stores URLs in `onboardImage`.

If your Postman only allows one file per key, send one file per request; for multiple images you may need to create one onboarding (with one image) and then update it with more images in a second request, or the backend may accept multiple rows with the same key—confirm by testing.
