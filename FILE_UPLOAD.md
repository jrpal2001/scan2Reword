# File (Image) Upload – How It Works

This doc explains the **scalable** upload flow: per-route Multer, S3 upload, and optional presigned URLs.

---

## 1. High-level flow

```
Client (multipart/form-data)
    → Route: upload.fields(allowedFields)   → req.body + req.files (object)
    → parseBodyJson                         → req.body JSON strings parsed
    → uploadToS3(folder)                    → compress → S3 → req.s3Uploads
    → Controller                            → reads req.s3Uploads (values = URL arrays)
```

- **No app-level Multer.** Each route that accepts files uses **one** `upload.fields(...)` so allowed fields are explicit.
- **Multer** uses `memoryStorage()` and **10MB** per file to limit RAM (e.g. 10 users × 10MB = 100MB, not 500MB).
- **uploadToS3** always sets **arrays** in `req.s3Uploads`: `req.s3Uploads.profilePhoto = [url]`, `req.s3Uploads.vehiclePhoto = [url1, url2]`.
- **Controllers** take the first URL for single-photo fields (e.g. `s3Uploads.profilePhoto?.[0]`) and use arrays as-is for `vehiclePhoto` / `attachments`.

---

## 2. Where Multer is used (per route)

**File:** `src/utils/multerConfig.js`

- **Config:** `memoryStorage`, **10MB** limit, fileFilter: JPEG, PNG, WEBP, PDF.
- **Field sets:**
  - `userUploadFields`: profilePhoto, driverPhoto, ownerPhoto, rcPhoto, insurancePhoto, fitnessPhoto, pollutionPhoto, vehiclePhoto (max 5).
  - `transactionUploadFields`: attachments (max 5).

**Each file-upload route** uses exactly **one** Multer middleware:

| Route | Middleware chain |
|-------|-------------------|
| POST /api/auth/register | `upload.fields(userUploadFields)` → parseBodyJson → uploadToS3('users/registration') → validate → controller |
| POST /api/admin/users | `upload.fields(userUploadFields)` → parseBodyJson → uploadToS3('users') → validate → controller |
| POST /api/manager/users | same |
| POST /api/staff/users | same |
| POST /api/owner/vehicles | same |
| POST /api/transactions | `upload.fields(transactionUploadFields)` → parseBodyJson → uploadToS3('transactions') → validate → controller |

**parseBodyJson** (after Multer) parses JSON strings in `req.body` (e.g. `vehicle`, `owner` sent as form string).

**formDataParser** (app-level) no longer parses multipart; it only skips so the route-level Multer can read the body.

---

## 3. req.s3Uploads shape (always arrays)

- **uploadToS3** sets `uploadsObj[fieldName] = fieldUploads` (always an array of URL strings).
- Single file → `req.s3Uploads.profilePhoto = [url]`.
- Multiple files → `req.s3Uploads.vehiclePhoto = [url1, url2]`, `req.s3Uploads.attachments = [url1, url2, url3]`.

Controllers that need a single URL use `s3Uploads.profilePhoto?.[0] ?? null`. Those that need arrays use `s3Uploads.vehiclePhoto || []`.

---

## 4. uploadToS3 middleware

**File:** `src/middlewares/uploadToS3.js`

- **Input:** `req.files` (object from `upload.fields()`: `{ profilePhoto: [file], vehiclePhoto: [f1, f2] }`).
- **Behavior:**
  1. If no files: `req.s3Uploads = {}`, `next()`.
  2. For each field: compress images (sharp), upload to S3, collect URLs.
  3. Set `req.s3Uploads[fieldName] = fieldUploads` (array).
- **Parameter:** `folder` (e.g. `'users'`, `'users/registration'`, `'owners/fleet'`, `'transactions'`).

---

## 5. S3 and compression

- **putObject.js:** uploads buffer to S3, returns `{ url, key }`.
- **imageCompressor.js:** `compressMulterFile()` compresses images (max 1920px, quality 80); PDFs unchanged. Used inside uploadToS3 before S3.

---

## 6. Memory and scalability

- **Current:** One Multer per route, 10MB per file, memory storage. Many concurrent 10MB uploads can still spike RAM.
- **Recommendations:**
  - Keep **10MB (or 5MB)** for images; reject larger files.
  - **Best for scale:** client uploads **directly to S3** via **presigned URLs**: backend returns a presigned POST/PUT URL; client uploads the file to S3; client then calls your API with the final S3 key/URL. No file passes through your server, so no RAM spike. This would require new endpoints (e.g. `POST /api/upload/presigned`) and a slightly different client flow.

---

## 7. Will this affect existing APIs?

- **External API (request/response):** No. Clients still send the same `multipart/form-data` and field names; responses are unchanged.
- **Internal:** Controllers now read `req.s3Uploads` as arrays (e.g. `profilePhoto?.[0]`). Services still receive single URLs or arrays as before.

---

## 8. Summary

- **One Multer per route** via `upload.fields(userUploadFields)` or `upload.fields(transactionUploadFields)`.
- **No app-level** `upload.any()`; formDataParser no longer parses multipart.
- **req.s3Uploads** values are **always arrays**; controllers take `[0]` for single-photo fields.
- **10MB** limit per file to reduce RAM risk.
- **Presigned URL** upload (client → S3 directly) is the recommended next step for high scalability.
