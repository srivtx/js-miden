# 00-PROBLEM.md — File Uploader (M06)

## WHAT

Build a single-endpoint Express service that accepts multipart file uploads, validates them, persists them to disk, and makes them available via a static URL.

**Endpoint:** `POST /upload`
- Accepts `multipart/form-data` with field name `image`.
- Max file size: **5 MB**.
- Allowed types: `image/jpeg`, `image/png`, `image/gif`.
- Returns a public URL like `/uploads/<filename>`.

## WHY

File upload is one of the **most dangerous** operations in web development because it:

- Accepts untrusted binary data from anonymous users.
- Expands the attack surface to the filesystem (path traversal, overwrites).
- Can exhaust server resources (disk, memory, CPU on image processing).
- Is a common vector for malware distribution if not validated.

Understanding the mechanics of streaming, validation, and persistence is foundational for backend engineers.

## CONSTRAINTS

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max file size | 5 MB | Prevents disk exhaustion from a single request |
| Field name | `image` | Enforced by `multer.single('image')` |
| Storage | Local disk | Simpler than S3 for a micro project |
| File types | JPEG, PNG, GIF via MIME | Baseline validation; magic numbers preferred in production |
| Filename | UUID + original extension | Prevents path traversal while keeping type hint |
| Static serving | `express.static` | Simple, but consider CDN for scale |

## SCOPE

### In Scope
- Multipart parsing with `multer`.
- MIME type whitelist filter.
- Size limit enforcement.
- UUID-based filename generation.
- Static file serving from `/uploads/`.

### Out of Scope
- Cloud storage (S3, GCS, R2).
- Image resizing / watermarking.
- Virus scanning (ClamAV).
- CDN integration.
- Signed URLs or access control.

## ACCEPTANCE CRITERIA

1. Upload a valid 1 MB PNG → `200` with URL pointing to existing file.
2. Upload a 6 MB file → `413` "File too large."
3. Upload `file.exe` → `400` "Only .jpg, .png, .gif files are allowed."
4. Upload `../../../etc/passwd` → sanitized filename, no path traversal.
5. File remains accessible via `GET /uploads/<filename>` after upload completes.

## SOURCES

- [OWASP — Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [Mozilla — Sending form data](https://developer.mozilla.org/en-US/docs/Learn/Forms/Sending_and_retrieving_form_data)
- [Node.js Docs — Stream](https://nodejs.org/api/stream.html)
