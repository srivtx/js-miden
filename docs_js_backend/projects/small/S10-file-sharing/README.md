# S10: File Sharing API

## Overview
An API for uploading files, generating time-limited shareable links, downloading files via tokens, and tracking download counts.

## Thinking Framework

### PHASE 1: Core Features
- Upload a file and receive a unique shareable token.
- Download the file using the token.
- Enforce link expiration (24 hours).
- Track how many times a file has been downloaded.

### PHASE 2: Design Decisions
- **Signed URLs vs Database Tokens**: Signed URLs (e.g., AWS S3 presigned URLs) offload authorization to the storage provider and scale better. Database tokens offer more control and audit logging.
- **Expiration Logic**: Store expiration timestamps and check them at both generation and download time. A background job should clean up expired files.
- **Storage**: Local filesystem is used here for simplicity. In production, use object storage like S3 or MinIO with pre-signed URLs.
- **Cleanup**: Expired file records and their storage objects must be purged to prevent unbounded growth.

### PHASE 3: Bugs & Hardening
This project intentionally contains bugs to test awareness:

1. **Expiration Not Enforced at Download**: The link expiration is calculated at upload time but **never checked** during the download request. The token works forever.
2. **Path Traversal**: The original filename is used directly as the storage key. A filename like `../../../etc/passwd` writes outside the intended upload directory.
3. **No Rate Limiting**: There is no rate limiting on downloads, making the endpoint susceptible to bandwidth abuse.

## Project Structure
```
src/
  db.ts       - SQLite in-memory database (file metadata)
  storage.ts  - Local filesystem storage with path traversal vulnerability
  files.ts    - Route handlers with missing expiration check on download
  app.ts      - Express application composition
  index.ts    - Server entry point
tests/
  files.test.ts - Vitest tests including expiration bypass and path traversal demos
```

## Running
```bash
npm install
npm run dev     # tsx src/index.ts
npm test        # vitest run
```

## Example Requests
```bash
# Upload file (base64 encoded)
curl -X POST http://localhost:3000/files/upload \
  -H "Content-Type: application/json" \
  -d '{"file":"aGVsbG8gd29ybGQ=","filename":"hello.txt"}'

# Download via token
curl -OJ http://localhost:3000/files/download/<token>

# Get file info
curl http://localhost:3000/files/info/<token>
```
