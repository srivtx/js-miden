# S10 File Sharing — Overview

## Project Goal
Build a simple file-sharing API where users upload files (base64-encoded) and receive a unique token to download them later. The project demonstrates secure token generation, storage abstraction, expiration logic, and path traversal prevention.

## Key Features
- **Upload**: Accept base64-encoded files, generate UUID tokens, and store metadata in SQLite.
- **Download**: Retrieve files via opaque tokens.
- **Expiration**: Tokens are generated with a 24-hour expiration (though the current implementation has a bug where expiration is not enforced on download).
- **Info endpoint**: Check file metadata and download count.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: SQLite (`better-sqlite3`)
- **Storage**: Local filesystem (`/tmp/s10-uploads`)
- **Language**: TypeScript

## High-Level Architecture

```
┌──────────────┐      HTTP/JSON      ┌──────────────┐     SQL       ┌──────────┐
│   Client     │ ────────────────── │   Express    │ ──────────── │  SQLite  │
│  (curl/      │                    │   Router     │              │ files.db │
│   test)      │   base64 file      │   (files.ts) │              └──────────┘
└──────────────┘ ─────────────────► │              │ ───────────► ┌──────────┐
                                     │              │   fs ops     │ /tmp/... │
                                     └──────────────┘              └──────────┘
```

## Entry Points
- `src/index.ts` — Server bootstrap.
- `src/app.ts` — Express app setup.
- `src/files.ts` — Upload, download, and info endpoints.
- `src/storage.ts` — Local filesystem abstraction (save, read, delete).
- `src/db.ts` — SQLite initialization.
- `tests/files.test.ts` — Test suite.

## Scope & Limitations
This project intentionally contains two security issues:
1. **Path traversal**: The storage layer uses the raw user-provided filename as the disk key.
2. **Missing expiration check**: The download endpoint does not verify `expires_at`, making tokens valid forever.
These are documented as learning exercises.
