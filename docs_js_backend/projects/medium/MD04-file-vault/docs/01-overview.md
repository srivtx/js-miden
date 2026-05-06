# MD04 File Vault — Project Overview

## Goal
Build a secure, scalable file storage service where files are **encrypted at rest** using AES-256-GCM, with streaming upload/download, pre-signed URLs, audit logging, and role-based access control (RBAC).

## Why This Matters
- **Data breaches** cost companies millions; encrypting files before they touch disk mitigates leaked-storage attacks.
- **Compliance**: SOC 2, ISO 27001, HIPAA, and GDPR all require encryption at rest and access logging.
- **Scale**: Files can be gigabytes; loading an entire video into RAM to encrypt it is not viable. Streaming encryption is required.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Client    │─────▶│  API Server  │─────▶│   Object Store  │
│  (Uploader) │      │  (Node.js)   │      │  (S3/MinIO/...) │
└─────────────┘      └──────────────┘      └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Key Store   │
                     │ (AWS KMS /   │
                     │  HashiCorp   │
                     │    Vault)    │
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Audit Logger │
                     │  (append-    │
                     │   only DB)   │
                     └──────────────┘
```

## Core Modules
1. **Crypto Service** (`src/utils/crypto.ts`) — streaming AES-256-GCM, key wrapping.
2. **File Service** (`src/services/fileService.ts`) — CRUD, chunking, metadata.
3. **Access Service** (`src/services/accessService.ts`) — RBAC, ownership, sharing.
4. **URL Signer** (`src/utils/urlSigner.ts`) — time-limited, signed download URLs.
5. **Audit Logger** — immutable, tamper-evident logs of every access.

## Security Model
- **Confidentiality**: AES-256-GCM with per-file keys. Keys never leave the Key Store.
- **Integrity**: GCM authentication tag prevents tampering.
- **Availability**: Replicated object storage; signed URLs expire quickly.
- **Accountability**: Every read/write/delete is logged with actor, timestamp, and file ID.

## Tech Stack
- Node.js + Express / Fastify
- Prisma + PostgreSQL (metadata)
- MinIO / AWS S3 (object storage)
- AWS KMS / HashiCorp Vault (key management)
- Vitest (testing)

---

## Checklist
- [ ] Encryption keys are never logged or returned in API responses
- [ ] GCM nonces are unique per encryption operation (12-byte random)
- [ ] Audit logs are append-only and replicated
- [ ] RBAC denies by default; permissions are explicitly granted
- [ ] Pre-signed URLs expire in ≤ 15 minutes
