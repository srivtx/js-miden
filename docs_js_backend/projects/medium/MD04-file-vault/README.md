# MD04: Secure File Vault

A secure file storage and sharing system with encryption at rest, time-limited signed URLs, access control, audit logging, and automatic file expiration.

## Features

- **Encrypted File Upload**: Files are encrypted with AES-256-GCM before storage
- **Streaming Downloads**: Support for large files via streaming (no buffering in memory)
- **Time-Limited Signed URLs**: Secure, expiring download links
- **Access Control**: Granular permissions (reader, writer, admin)
- **Audit Logging**: Complete trail of who accessed what and when
- **File Expiration**: Automatic cleanup of expired files

## Thinking Framework

### PHASE 1: Core Implementation

1. **Upload Flow**:
   - Client uploads file via multipart/form-data
   - Server generates unique file encryption key (FEK)
   - Encrypts file with AES-256-GCM using FEK
   - Encrypts FEK with master key (envelope encryption)
   - Stores encrypted file to disk
   - Records metadata in database

2. **Download Flow**:
   - Client requests download or signed URL
   - Server verifies access permissions
   - Decrypts FEK with master key
   - Streams decrypted file to client (no buffering)
   - Logs access to audit log

3. **Access Control**:
   - File owner has full admin access
   - Owner can grant READER, WRITER, or ADMIN access to others
   - Every access checks permissions before serving file

4. **Audit Log**:
   - Records all UPLOAD, DOWNLOAD, VIEW, SHARE, DELETE actions
   - Includes IP address and user agent
   - Records ACCESS_DENIED for permission failures

5. **File Expiration**:
   - Optional `expiresAt` field on files
   - Background job checks and removes expired files

### PHASE 2: Architecture Decisions

**Encryption at Rest**:
- Use AES-256-GCM for authenticated encryption
- Generate unique IV per file
- Envelope encryption: master key encrypts file-specific keys
- Master key from environment; in production use AWS KMS / HashiCorp Vault

**Streaming**:
- Use Node.js transform streams for encryption/decryption
- Pipe file through crypto stream directly to response
- Never buffer entire file in memory
- Support for range requests for resumable downloads

**Signed URLs**:
- HMAC-SHA256 signature of fileId + timestamp
- URL expires after configured duration (default 1 hour)
- Redis tracks consumed URLs to prevent replay

**Key Management**:
- Master key in environment variable (dev)
- Key rotation support via encryptedKey versioning
- Each file gets unique FEK - compromise of one doesn't affect others

### PHASE 3: Advanced Considerations

- **Rate Limiting**: Per-user upload/download limits via Redis
- **Virus Scanning**: Integrate ClamAV for uploaded files
- **CDN Integration**: Signed CloudFront/Cloudflare URLs
- **Chunked Uploads**: Resumable multipart uploads for large files
- **Key Rotation**: Periodically re-encrypt files with new master key
- **Compliance**: GDPR deletion, HIPAA audit requirements

## Tech Stack

- Express 5 with TypeScript (ESM)
- Prisma ORM with PostgreSQL
- Redis for signed URL tracking and rate limiting
- Multer for file uploads (with streaming)
- Node.js crypto for AES-256-GCM encryption

## Bug Introduction

### Bug 1: Buffer Entire File in Memory
**Location**: `src/services/fileService.ts` in `downloadFile` function
**Issue**: Instead of streaming, the function reads the entire encrypted file into memory, decrypts it, and then sends. This causes crashes for files larger than available RAM.
**Impact**: Server crashes on files > 1GB. Memory exhaustion DoS.

### Bug 2: Hardcoded Encryption Key
**Location**: `src/utils/crypto.ts` - `getMasterKey()` function
**Issue**: Falls back to hardcoded key when env var is missing. All files encrypted with same predictable key.
**Impact**: If attacker gets database + code, all files are decryptable.

### Bug 3: No Access Control on Signed URLs
**Location**: `src/routes/files.ts` - signed URL generation endpoint
**Issue**: Any authenticated user can generate a signed URL for any file by changing the fileId parameter. No ownership/permission check.
**Impact**: Data leak - any file accessible by any user with a valid JWT.

## Running the Project

```bash
# Start dependencies
docker-compose up -d

# Copy env and install
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate

# Run with bugs
npm run dev

# Run tests
npm test
```

## API Endpoints

- `POST /api/files/upload` - Upload a file (multipart)
- `GET /api/files` - List accessible files
- `GET /api/files/:id` - Get file metadata
- `GET /api/files/:id/download` - Direct download (checks auth)
- `POST /api/files/:id/signed-url` - Generate time-limited download URL
- `GET /api/files/download/:token` - Download via signed URL
- `POST /api/files/:id/share` - Share file with another user
- `DELETE /api/files/:id` - Delete file
- `GET /api/files/:id/audit` - Get audit log for file

## Project Structure

```
src/
├── index.ts              # Entry point
├── config/               # Configuration
├── routes/
│   ├── auth.ts          # Authentication routes
│   └── files.ts         # File routes
├── middleware/
│   ├── auth.ts          # JWT auth middleware
│   ├── errorHandler.ts  # Global error handler
│   └── audit.ts         # Audit logging middleware
├── services/
│   ├── fileService.ts   # File CRUD + streaming
│   ├── cryptoService.ts # Encryption/decryption
│   └── accessService.ts # Access control logic
├── utils/
│   ├── crypto.ts        # Crypto utilities
│   └── urlSigner.ts     # Signed URL generation
└── types/
    └── index.ts         # TypeScript types
```
