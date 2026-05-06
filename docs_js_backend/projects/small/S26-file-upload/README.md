# S26 File Upload Service

Secure file upload service with multipart handling, magic-number validation, virus scanning stub, storage abstraction, and image processing.

## Features

- Multipart form handling via Multer
- File type validation using magic numbers (file-type)
- Size limits and rate limiting
- Storage abstraction: Local filesystem and S3-compatible (MinIO)
- Image processing: resize, watermark, thumbnails (Sharp)
- Virus scanning stub interface

## Intentional Bug

Path traversal vulnerability: filenames like `../../../etc/passwd` are not sanitized before being passed to the storage layer.

## Scripts

```bash
npm run dev       # Start development server
npm test          # Run Vitest tests (includes bug reproduction)
npm run build     # Compile TypeScript
```

## Docker

```bash
docker-compose up -d
```
