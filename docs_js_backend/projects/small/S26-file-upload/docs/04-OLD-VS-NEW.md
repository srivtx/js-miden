# 04-OLD-VS-NEW

## 2015 Patterns
- Trust file extensions (`file.mimetype`).
- Save directly to `uploads/` with user-provided filenames.
- No virus scanning; "we'll add it later."
- Image processing with ImageMagick CLI via `child_process.exec`.
- No storage abstraction; filesystem only.

## 2025 Patterns
- Magic-number validation using `file-type`.
- UUID-based filenames stored in metadata DB; original name kept for UX only.
- Async virus scanning with ClamAV or cloud APIs (Cloudmersive, VirusTotal).
- Sharp for fast, safe image pipelines in Node.js.
- Storage abstraction: local for dev, S3/MinIO/R2 for production.
- Signed upload URLs for direct browser-to-S3 uploads to reduce server bandwidth.
