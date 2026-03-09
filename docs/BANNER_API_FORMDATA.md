# Banner APIs – Form-Data & Image Upload (AWS S3)

This doc describes how to call the **Admin** and **Manager** banner APIs using **form-data** and how to **upload a banner image to AWS S3** on create/update.

---

## 1. Base URLs & Auth

All these endpoints require **Bearer token** in the header:

```http
Authorization: Bearer <access_token>
```

| Role    | Base path        | Example base URL                    |
|--------|-------------------|-------------------------------------|
| Admin  | `/api/admin`      | `http://localhost:3000/api/admin`    |
| Manager| `/api/manager`    | `http://localhost:3000/api/manager` |

---

## 2. List Banners (GET) – No Form-Data

**Admin:** `GET /api/admin/banners`  
**Manager:** `GET /api/manager/banners`

- **Body:** None.
- **Query:** `page`, `limit`, `status`, `pumpId` (all optional).
- **Content-Type:** Not required (no body).

Example:

```http
GET /api/admin/banners?page=1&limit=10&status=active
Authorization: Bearer <token>
```

---

## 3. Get One Banner (GET) – No Form-Data

**Admin:** `GET /api/admin/banners/:bannerId`  
**Manager:** `GET /api/manager/banners/:bannerId`

- **Body:** None.
- **Params:** `bannerId` in URL.

Example:

```http
GET /api/admin/banners/507f1f77bcf86cd799439011
Authorization: Bearer <token>
```

---

## 4. Create Banner (POST) – Form-Data + Image Upload to S3

**Admin:** `POST /api/admin/banners`  
**Manager:** `POST /api/manager/banners`

Use **multipart/form-data**. You can send the banner image as a **file**; the backend uploads it to **AWS S3** (folder `banners/`) and stores the returned URL in `imageUrl`.

### Headers

```http
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

(Do not set `Content-Type` manually when sending a file – the client will set it with the boundary.)

### Form fields

| Field       | Type   | Required | Description |
|------------|--------|----------|-------------|
| `title`    | string | Yes      | 2–200 chars. |
| `description` | string | No    | Optional text. |
| `imageUrl` | **file** or string | No | **Image file** (e.g. JPEG/PNG) – uploaded to S3; or a **URL string** if you already have an image URL. |
| `linkUrl`  | string | No       | Valid URI (e.g. offer page). |
| `startTime`| string | Yes      | ISO 8601 date, e.g. `2025-03-01T00:00:00.000Z`. |
| `endTime`  | string | Yes      | ISO 8601 date, e.g. `2025-03-31T23:59:59.000Z`. |
| `pumpIds`  | string | No       | **JSON string** array of pump IDs, e.g. `["id1","id2"]`. Admin: omit or `[]` = all pumps. Manager: at least one pump required. |
| `status`   | string | No       | `active` or `expired`, default `active`. |

### Example (Postman / form-data)

1. Method: **POST**  
   URL: `http://localhost:3000/api/admin/banners` (or `/api/manager/banners`).
2. Headers: `Authorization: Bearer <your_admin_or_manager_token>`.
3. Body: **form-data** (not raw JSON).

**Important:** In the form-data table, set the **type** correctly for each row:
- **Only `imageUrl`** should be **File** (and attach an image).
- **All other fields** must be **Text** (not File). If you set `title` or any text field to File by mistake, you will get a validation error like `"title" is required; "title" is not allowed`.

| Key         | Type  | Value |
|------------|-------|--------|
| title      | **Text**  | Weekend Fuel Offer |
| description| **Text**  | Save more this weekend |
| imageUrl   | **File** | (select image file) |
| linkUrl    | **Text**  | https://example.com/offer |
| startTime  | **Text**  | 2025-03-01T00:00:00.000Z |
| endTime    | **Text**  | 2025-03-31T23:59:59.000Z |
| pumpIds    | **Text**  | []  *(Admin, all pumps)* or `["69a03e0efe9553a49e7adb21"]` *(Manager or specific pumps)* |
| status     | **Text**  | active |

- If you **omit** `imageUrl` or send only text fields, you can send **raw JSON** with `Content-Type: application/json` and `imageUrl` as a string URL (no file upload).

### Example (cURL with file upload)

```bash
curl -X POST "http://localhost:3000/api/admin/banners" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Weekend Fuel Offer" \
  -F "description=Save more this weekend" \
  -F "imageUrl=@/path/to/banner.jpg" \
  -F "linkUrl=https://example.com/offer" \
  -F "startTime=2025-03-01T00:00:00.000Z" \
  -F "endTime=2025-03-31T23:59:59.000Z" \
  -F "pumpIds=[]" \
  -F "status=active"
```

### Flow (create)

1. Client sends **multipart/form-data** with optional file field `imageUrl`.
2. **Multer** parses the request; file is in `req.files`, other fields in `req.body`.
3. **parseBodyJson** parses any JSON strings in `req.body` (e.g. `pumpIds`).
4. **uploadToS3('banners')** uploads the file to S3 under `banners/`, puts the URL in `req.s3Uploads.imageUrl[0]`.
5. **validateRequest** validates `req.body` (create schema); `imageUrl` is optional.
6. **Controller** builds `data` from `req.validated` and, if `req.s3Uploads.imageUrl[0]` exists, sets `data.imageUrl` to that S3 URL.
7. Banner is created with that `imageUrl` (or without if no file/URL was sent).

---

## 5. Update Banner (PATCH) – Form-Data + Optional Image Upload

**Admin:** `PATCH /api/admin/banners/:bannerId`  
**Manager:** `PATCH /api/manager/banners/:bannerId`

Same as create: use **multipart/form-data** when you want to **upload a new image**; the new file is uploaded to S3 and the banner’s `imageUrl` is updated.

### Form fields (all optional)

| Field       | Type   | Description |
|------------|--------|-------------|
| title      | string | 2–200 chars. |
| description| string | |
| imageUrl   | **file** or string | **New image file** → uploaded to S3 and replaces `imageUrl`; or new URL string. |
| linkUrl    | string | URI. |
| startTime  | string | ISO 8601. |
| endTime    | string | ISO 8601. |
| pumpIds    | string | JSON array string, e.g. `["id1","id2"]`. |
| status     | string | `active` \| `expired`. |

Send only the fields you want to change. If you send a new **file** for `imageUrl`, it is uploaded to S3 and the banner’s `imageUrl` is set to the new URL.

### Example (Postman)

- Method: **PATCH**  
  URL: `http://localhost:3000/api/admin/banners/507f1f77bcf86cd799439011`
- Body: **form-data**

| Key     | Type | Value        |
|---------|------|--------------|
| title   | Text | Updated Title |
| imageUrl| File | (new image)   |

---

## 6. Delete Banner (DELETE) – No Form-Data

**Admin:** `DELETE /api/admin/banners/:bannerId`  
**Manager:** `DELETE /api/manager/banners/:bannerId`

- **Body:** None.
- **Params:** `bannerId` in URL.

```http
DELETE /api/admin/banners/507f1f77bcf86cd799439011
Authorization: Bearer <token>
```

---

## 7. Troubleshooting

### Error: `"title" is required; "title" is not allowed`

- **Cause:** A form field that must be text (e.g. `title`) was sent as **File** in Postman, or the request body was not parsed correctly.
- **Fix in Postman:**
  1. In the **Body** tab, choose **form-data**.
  2. For **title**, **description**, **linkUrl**, **startTime**, **endTime**, **pumpIds**, **status** → set the type dropdown to **Text** (not File).
  3. Only **imageUrl** should be **File** (with an image selected).
  4. Re-send the request.

The backend now normalizes the body so that any field accidentally sent as a file is stripped before validation; you should get a single clear “required” error if a text field is missing.

---

## 8. Summary Table

| Method | Endpoint (Admin)           | Endpoint (Manager)           | Body / Form-Data | Image upload |
|--------|----------------------------|------------------------------|------------------|--------------|
| GET    | `/api/admin/banners`       | `/api/manager/banners`       | None (query only) | No |
| GET    | `/api/admin/banners/:id`   | `/api/manager/banners/:id`   | None             | No |
| POST   | `/api/admin/banners`       | `/api/manager/banners`       | **form-data**    | Yes, field `imageUrl` (file) → S3 |
| PATCH  | `/api/admin/banners/:id`   | `/api/manager/banners/:id`   | **form-data**    | Yes, field `imageUrl` (file) → S3 |
| DELETE | `/api/admin/banners/:id`   | `/api/manager/banners/:id`   | None             | No |

- **Create/Update:** Use **form-data** to send text fields and optionally an **image file** in `imageUrl`; the backend uploads the file to **AWS S3** under `banners/` and stores the URL in the banner’s `imageUrl`.
- **List / Get one / Delete:** No form-data; use query params or URL params as above.
