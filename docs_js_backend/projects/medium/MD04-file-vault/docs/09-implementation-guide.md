# Implementation Guide

## Project Structure

```
MD04-file-vault/
├── src/
│   ├── index.ts              # Entry point, Express app
│   ├── routes/
│   │   ├── auth.ts           # JWT login/register
│   │   └── files.ts          # Upload, download, share, delete
│   ├── services/
│   │   ├── fileService.ts    # File metadata, chunking
│   │   └── accessService.ts  # RBAC checks
│   ├── utils/
│   │   ├── crypto.ts         # AES-256-GCM streaming
│   │   └── urlSigner.ts      # Pre-signed URL generation
│   └── middleware/
│       ├── auth.ts           # JWT verification
│       └── errorHandler.ts   # Global error handler
├── tests/
│   └── file.test.ts          # Integration tests
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Seed data
├── docs/                     # ← Documentation (this folder)
├── docker-compose.yml        # Postgres + MinIO
├── package.json
└── vitest.config.ts
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Create user account |
| `POST` | `/auth/login` | No | Get JWT access token |
| `POST` | `/files` | Yes | Initiate upload, return pre-signed PUT URL |
| `GET` | `/files/:id/download` | Yes | Return pre-signed GET URL |
| `GET` | `/files/:id` | Yes | Get file metadata |
| `DELETE` | `/files/:id` | Yes | Delete file (owner only) |
| `POST` | `/files/:id/share` | Yes | Share file with another user |
| `GET` | `/files/:id/audit` | Yes | View audit log for file |

## Running the Project

```bash
# Start dependencies
docker-compose up -d

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed data
npx tsx prisma/seed.ts

# Run tests
npm test

# Start server
npm run dev
```

## Environment Variables

```bash
# .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/filevault?schema=public"
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="file-vault"
KMS_KEY_ID="alias/file-vault-master"
JWT_SECRET="super-secret-change-in-production"
```

## Testing Checklist

- [ ] Upload a 5 GB file; confirm memory usage stays under 200 MB
- [ ] Download a file; confirm plaintext matches original
- [ ] Tamper with ciphertext in S3; confirm decryption fails with auth tag error
- [ ] Attempt download with expired pre-signed URL; confirm 403
- [ ] Attempt to delete another user's file; confirm 403
- [ ] Verify audit log contains hash chain; tamper with DB row; verify integrity check fails
- [ ] Run `npm audit`; fix all high/critical vulnerabilities

## Security Checklist

- [ ] No plaintext keys in logs, env, or responses
- [ ] AES-256-GCM with random IV per file/segment
- [ ] Pre-signed URLs expire in ≤ 15 minutes
- [ ] RBAC denies by default
- [ ] Audit logs are append-only and replicated
- [ ] File size limits and rate limits enforced
- [ ] `fileId` validated against path traversal (`../`)
- [ ] Dependencies scanned for vulnerabilities
- [ ] HTTPS enforced in production
- [ ] CORS configured to allow only trusted origins
