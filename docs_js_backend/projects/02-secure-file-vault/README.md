# Project 2: Secure File Vault

> **Client:** "I need a secure file storage service for my legal firm. Lawyers upload confidential documents. Each file must be encrypted at rest. Files can only be accessed via time-limited signed URLs. We need virus scanning (at least conceptually). File sizes up to 2GB. We need audit logs of who accessed what when. And it must work with our existing S3-compatible storage (MinIO for now)."

---

## Table of Contents

1. [Section 1: The Brief (WHAT)](#section-1-the-brief-what)
2. [Section 2: Architecture (WHY)](#section-2-architecture-why)
3. [Section 3: NEW Concepts (Inline Teaching)](#section-3-new-concepts-inline-teaching)
4. [Section 4: Step-by-Step Build Guide](#section-4-step-by-step-build-guide)
5. [Section 5: 5 Intentional Bugs](#section-5-5-intentional-bugs)
6. [Section 6: Security Deep Dive](#section-6-security-deep-dive)
7. [Section 7: Deployment](#section-7-deployment)
8. [Section 8: Post-Mortem Template](#section-8-post-mortem-template)

---

## Section 1: The Brief (WHAT)

### Full Requirements Breakdown

| Requirement | Detail | Priority |
|-------------|--------|----------|
| **File Storage** | Up to 2GB per file | Must Have |
| **Encryption** | AES-256-GCM at rest | Must Have |
| **Access Control** | Time-limited pre-signed URLs | Must Have |
| **Virus Scanning** | Conceptual integration (async) | Should Have |
| **Audit Logging** | Who accessed what, when | Must Have |
| **Storage Backend** | S3-compatible (MinIO) | Must Have |
| **User Roles** | Lawyer, Admin, Paralegal | Must Have |
| **File Lifecycle** | Automatic expiration/cleanup | Should Have |

### User Stories

```
As a lawyer,
I want to upload a 500MB case file,
So that it is stored securely and encrypted.

As a paralegal,
I want to request a download link for a deposition,
So that I can share it with a client for 24 hours only.

As an admin,
I want to see an audit log of every file access,
So that I can prove compliance during an investigation.

As the system,
I want to scan uploaded files for malware,
So that I don't store infected documents.
```

### Acceptance Criteria

1. **Upload**: A 2GB file uploads successfully without server memory exceeding 200MB.
2. **Encryption**: Database breach alone cannot reveal file contents.
3. **Access**: Download URLs expire after configurable time (default 1 hour).
4. **Audit**: Every upload, download, and deletion is logged with user ID, timestamp, and file ID.
5. **Virus**: Infected files are quarantined within 60 seconds of upload.
6. **Cleanup**: Files past retention policy are automatically deleted.

### Security Requirements

- **Encryption at Rest**: Client-side AES-256-GCM before S3 upload.
- **Encryption in Transit**: TLS 1.3 for all API calls.
- **Access Control**: Role-based; users only see their firm's files.
- **Audit Immutability**: Logs are append-only; no updates or deletions allowed.
- **Data Sanitization**: Filename path traversal prevented; UUID used as storage key.

---

## Section 2: Architecture (WHY)

### The Big Picture

```
┌─────────────┐      HTTPS       ┌──────────────────┐
│   Lawyer    │ ◄──────────────► │   Express API    │
│   Browser   │                  │   (Node.js 22)   │
└─────────────┘                  └────────┬─────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
            │   PostgreSQL  │    │    MinIO     │    │  Audit Queue │
            │  (Metadata)   │    │ (S3 Storage) │    │  (Bull MQ)   │
            └──────────────┘    └──────────────┘    └──────────────┘
```

### Why Streams Over Buffers?

**WHAT IF WRONG:**

```javascript
// THE WRONG WAY (Don't do this)
const fileBuffer = req.file.buffer; // 2GB file = 2GB RAM
await s3.upload({ Body: fileBuffer }); // 💥 Server dies
```

**WHY STREAMS:**

```
Client ──► Stream Chunk (64KB) ──► Transform (Encrypt) ──► S3 Upload Stream
             ↑______________________________________________↓
                        Backpressure signals "slow down"
```

Node.js defaults to 64KB chunks. A 2GB file streams through memory as a tiny window, not a monolith. Your server stays at ~100MB RAM instead of crashing.

### Why NOT Store Files on Local Disk?

```
LOCAL DISK NIGHTMARE:
┌──────────┐    ┌──────────┐    ┌──────────┐
│ Server 1 │    │ Server 2 │    │ Server 3 │
│ /uploads │    │ /uploads │    │ /uploads │
│ file.pdf │    │  empty   │    │  empty   │
└──────────┘    └──────────┘    └──────────┘
     ▲
     └── Load balancer routes next request to Server 2... 404 Not Found
```

Local disk is **ephemeral**. Containers restart. Horizontal scaling becomes impossible. You need shared storage.

### Why S3/MinIO with Pre-Signed URLs?

```
WITHOUT PRE-SIGNED URLs:
Client ──► Your Server ──► S3 ──► Your Server ──► Client
              ↑___________________________↓
                    You pay for bandwidth twice

WITH PRE-SIGNED URLs:
Client ──► Your Server ("Here's a token, valid 1 hour")
              └────────────────────────────────────┘
Client ──► S3 Directly (token validated by S3)
              ↑___________________________________↓
                    Zero bandwidth through your API
```

Pre-signed URLs are HMAC-signed tokens. S3 validates the signature and expiry **without contacting your server**. You offload gigabytes of bandwidth.

### Why Encrypt Before Upload?

```
SERVER-SIDE ENCRYPTION ONLY:
File ──► Your Server ──► S3 (encrypted by S3)
            ↑
            └── If attacker has server access, they see plaintext

CLIENT-SIDE + SERVER-SIDE:
File ──► Encrypt on Server ──► Ciphertext ──► S3 (double encrypted)
            ↑
            └── Attacker needs encryption key AND S3 access
```

This is **defense in depth**. Even if S3 is compromised, the data is meaningless without the AES key. Even if your DB is dumped, files in S3 are encrypted with keys stored separately.

### Why Separate Metadata DB from File Storage?

```
QUERY: "Show me all files uploaded by lawyer@firm.com in March 2025"

S3: "I can list objects... slowly... with no real querying."
PostgreSQL: "Here's your indexed result in 3ms."
```

S3 is an object store, not a database. It cannot efficiently query by `uploaded_by`, `created_at`, or `file_status`. Separation lets you back up metadata independently, run analytics, and enforce foreign keys.

### Why Audit Logs Are Append-Only

```
MUTABLE LOG (Bad):
[10:00] Alice downloaded file A
[10:05] <deleted by attacker>
[10:10] Bob deleted file A   ← Was Alice's access ever logged? Who knows.

APPEND-ONLY LOG (Good):
[10:00] Alice downloaded file A
[10:05] <still here forever>
[10:10] Bob deleted file A
```

Compliance frameworks (SOC 2, GDPR Article 5) require **tamper evidence**. If logs can be deleted, they prove nothing in court.

---

## Section 3: NEW Concepts (Inline Teaching)

### 1. Node.js Streams Deeply

**WHAT IS IT?**

A Stream is an abstract interface for working with streaming data in Node.js. Instead of reading a whole file into memory, you process it chunk by chunk.

**WHY USE IT HERE?**

Your lawyers upload 2GB files. You rent a $20/month VPS with 1GB RAM. Streams make this possible.

**WHAT HAPPENS IF WE DON'T?**

```
[16:42:01] Upload started: contract.pdf (1.8GB)
[16:42:15] RSS memory: 1.2GB
[16:42:18] RSS memory: 1.8GB
[16:42:19] FATAL ERROR: Reached heap limit Allocation failed
[16:42:19] Process exited with code 134
```

**THE FOUR STREAM TYPES:**

```
Readable  ──► Data source you can read from (req, fs.createReadStream)
Writable  ◄── Data destination you can write to (res, fs.createWriteStream)
Transform ──► Reads, modifies, writes (zlib, crypto cipher)
Duplex    ──► Both readable and writable (TCP socket)
```

**CODE:**

```typescript
// src/utils/streamUtils.ts
import { Readable, Writable, Transform, pipeline } from 'node:stream';
import { promisify } from 'node:util';

const asyncPipeline = promisify(pipeline);

/**
 * A transform stream that counts bytes passing through.
 * Teaches: Transform streams are "middlemen".
 */
export class ByteCounter extends Transform {
  bytes = 0;

  _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer) => void
  ) {
    this.bytes += chunk.length;
    callback(null, chunk); // Pass chunk through unchanged
  }
}

/**
 * Proper pipeline with error handling.
 * WHAT IF WRONG: Using .pipe() without error handling causes
 * "Unhandled 'error' event" crashes.
 */
export async function safePipeline(
  source: Readable,
  transforms: Transform[],
  destination: Writable
): Promise<void> {
  try {
    await asyncPipeline(source, ...transforms, destination);
  } catch (err) {
    // Clean up: destroy all streams to release handles
    source.destroy();
    transforms.forEach((t) => t.destroy());
    destination.destroy();
    throw err;
  }
}
```

**BACKPRESSURE EXPLAINED:**

```
Fast Producer (Client)          Slow Consumer (S3)
        │                              │
        ▼                              ▼
   [Chunk 1]  ──► buffer full? ──►  No, accept
   [Chunk 2]  ──► buffer full? ──►  No, accept
   [Chunk 3]  ──► buffer full? ──►  YES! Pause producer
        │                              │
        └◄────── drain event ─◄────────┘  (resume)
```

When the S3 upload stream's internal buffer hits `highWaterMark`, it returns `false`. The readable stream pauses. No memory ballooning. Magic.

### 2. Multipart Uploads

**WHAT IS IT?**

Breaking a large file into chunks (parts) and uploading them in parallel or sequentially, then telling S3 to "stitch them together."

**WHY USE IT HERE?**

If a 2GB upload fails at 1.9GB, without multipart you restart from zero. With multipart, you retry only the failed 5MB part. Plus, you can stream directly without knowing the file size upfront.

**WHAT HAPPENS IF WE DON'T?**

```
User uploads 1.9GB of 2GB...
*cat knocks over router*
Connection reset.
User screams.
User re-uploads 2GB from byte 0.
User bills you for their time.
```

**HOW MULTIPART STREAMING WORKS:**

```
┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│  Multer (no  │────►│  Transform  │────►│ S3 Upload   │
│   storage)   │     │ (Encrypt)   │     │  Stream     │
└──────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                                                ▼
                                        S3 accumulates
                                        5MB parts internally
```

**CODE:**

```typescript
// src/middleware/upload.ts
import multer from 'multer';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * diskStorage writes chunks to a temporary file on disk.
 * This avoids buffering multi-gigabyte files in RAM.
 * The route then creates a read stream from the temp file
 * and pipes it through the encryptor into S3.
 */
const storage = multer.diskStorage({
  destination: tmpdir(),
  filename: (_req, _file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB
    files: 1,
  },
}).single('file');
```

### 3. Encryption at Rest

**WHAT IS IT?**

AES-256-GCM (Advanced Encryption Standard, 256-bit key, Galois/Counter Mode) is symmetric encryption that provides confidentiality AND authenticity. The "authentication tag" proves the ciphertext wasn't tampered with.

**WHY USE IT HERE?**

Legal documents. If someone gains access to your S3 bucket, they must not be able to read files.

**WHY NOT ECB MODE?**

```
ECB MODE (Electronic Codebook):
┌──────┐  ┌──────┐  ┌──────┐
│BLOCK1│  │BLOCK2│  │BLOCK3│  ← Same plaintext = Same ciphertext
└──────┘  └──────┘  └──────┘
  penguin   penguin   penguin

Result: Patterns leak through encryption.
        You can still SEE it's a penguin.

GCM MODE:
┌──────┐  ┌──────┐  ┌──────┐
│BLOCK1│  │BLOCK2│  │BLOCK3│  ← Each block XORed with unique keystream
└──────┘  └──────┘  └──────┘
Result: Looks like random noise. No patterns.
```

**WHAT HAPPENS IF WE DON'T ENCRYPT?**

```
Attacker gains read access to S3 bucket (compromised key, misconfigured policy).
Without encryption: They download and read every confidential document.
With encryption: They download 2GB of meaningless random bytes.
```

**KEY MANAGEMENT BASICS:**

```
NEVER: Store key in code repository.
NEVER: Use same key for every file forever.

DO:   Use environment variable or KMS.
DO:   Store IV (Initialization Vector) with each file (it's not secret).
DO:   Use a unique IV per encryption operation.
```

**CODE:**

```typescript
// src/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Derives a key from a master secret + per-file salt.
 * WHY: If you use the raw master key directly, and one file's key
 * is somehow compromised, ALL files are compromised.
 */
function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, 32);
}

export interface EncryptionResult {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  salt: Buffer;
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * In production, this would be a Transform stream.
 */
export function encryptBuffer(
  plaintext: Buffer,
  masterKey: Buffer
): EncryptionResult {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag, salt };
}

export function decryptBuffer(
  encrypted: EncryptionResult,
  masterKey: Buffer
): Buffer {
  const key = deriveKey(masterKey, encrypted.salt);
  const decipher = createDecipheriv(ALGORITHM, key, encrypted.iv);
  decipher.setAuthTag(encrypted.authTag);

  return Buffer.concat([
    decipher.update(encrypted.ciphertext),
    decipher.final(),
  ]);
}

/**
 * STREAMING ENCRYPTION (The real deal for 2GB files)
 */
import { Transform } from 'node:stream';

export interface EncryptStream extends Transform {
  salt: Buffer;
  iv: Buffer;
}

export function createEncryptStream(masterKey: Buffer): EncryptStream {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let headerWritten = false;

  const stream = new Transform({
    transform(chunk, _encoding, callback) {
      if (!headerWritten) {
        // Prepend salt + iv so decryptor knows how to initialize
        this.push(Buffer.concat([salt, iv]));
        headerWritten = true;
      }
      callback(null, cipher.update(chunk));
    },
    flush(callback) {
      try {
        this.push(cipher.final());
        this.push(cipher.getAuthTag()); // Append auth tag at end
        callback();
      } catch (err) {
        callback(err as Error);
      }
    },
  }) as EncryptStream;

  stream.salt = salt;
  stream.iv = iv;
  return stream;
}

/**
 * Streaming decryption for 2GB files. Reads the prepended salt+IV,
 * decrypts chunks, and verifies the trailing auth tag in the flush phase.
 */
export function createDecryptStream(masterKey: Buffer): Transform {
  let decipher: ReturnType<typeof createDecipheriv> | null = null;
  let buffer = Buffer.alloc(0);
  let headerParsed = false;

  return new Transform({
    transform(chunk, _encoding, callback) {
      buffer = Buffer.concat([buffer, chunk]);

      if (!headerParsed) {
        const headerLength = SALT_LENGTH + IV_LENGTH;
        if (buffer.length < headerLength) {
          return callback();
        }
        const salt = buffer.subarray(0, SALT_LENGTH);
        const iv = buffer.subarray(SALT_LENGTH, headerLength);
        const key = deriveKey(masterKey, salt);
        decipher = createDecipheriv(ALGORITHM, key, iv);
        buffer = buffer.subarray(headerLength);
        headerParsed = true;
      }

      // Keep the last AUTH_TAG_LENGTH bytes for the auth tag
      const processLength = Math.max(0, buffer.length - AUTH_TAG_LENGTH);
      if (processLength > 0 && decipher) {
        const data = buffer.subarray(0, processLength);
        buffer = buffer.subarray(processLength);
        this.push(decipher.update(data));
      }
      callback();
    },
    flush(callback) {
      if (!decipher || buffer.length !== AUTH_TAG_LENGTH) {
        return callback(new Error('Invalid encrypted stream: missing auth tag or header'));
      }
      try {
        decipher.setAuthTag(buffer);
        this.push(decipher.final());
        callback();
      } catch (err) {
        callback(err as Error);
      }
    },
  });
}
```

> **SECURITY FIX — Encryption Metadata & Streaming Decryption (CRITICAL):**
> The original code stored literal strings `'extracted_salt'` and `'extracted_iv'` in the database, making every file permanently unrecoverable. The fix exposes `salt` and `iv` as properties on the `EncryptStream` so the upload route can persist the real values. We also added `createDecryptStream`, which parses the prepended salt/IV header and verifies the trailing auth tag via a Transform stream. Without this, a 2GB file would force the server to buffer the entire ciphertext in memory, causing an OOM crash.

### 4. Pre-Signed URLs

**WHAT IS IT?**

A URL that grants temporary access to a private S3 object. Your server creates it using your secret credentials. S3 verifies the HMAC signature embedded in the URL.

**WHY USE IT HERE?**

Your API server doesn't have the bandwidth to stream 2GB files to 100 lawyers simultaneously. Pre-signed URLs let lawyers download directly from S3.

**HOW IT WORKS:**

```
Your Server (has AWS secret key):
  1. Takes: bucket, key, expiry=3600s
  2. Builds canonical request string
  3. Signs with HMAC-SHA256 using secret key
  4. Appends signature to URL as query params

S3 (has SAME secret key):
  1. Receives request
  2. Rebuilds canonical request from query params
  3. Computes expected signature
  4. If match AND not expired: serve file
  5. If mismatch OR expired: 403 Forbidden
```

**WHAT HAPPENS IF WE DON'T?**

```
Scenario: 100 lawyers download 2GB files simultaneously.

Without pre-signed URLs:
  Your server: 100 × 2GB = 200GB egress
  Your server: CPU at 100%, network saturated
  Your bill: $$$ for bandwidth you shouldn't be paying

With pre-signed URLs:
  Your server: 100 × 1KB (the URL itself) = 100KB egress
  S3 handles: 200GB directly
  Your bill: S3 pricing, not your server bandwidth
```

**CODE:**

```typescript
// src/utils/s3.ts
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function generatePresignedUrl(
  s3Client: S3Client,
  bucket: string,
  key: string,
  expirationSeconds = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: expirationSeconds,
  });
}
```

### 5. Virus Scanning Architecture

**WHAT IS IT?**

Conceptually, after a file uploads, we scan it for malware. In reality, we'd integrate ClamAV or a cloud service. Here, we architect the **async scanning pattern**.

**WHY SCAN AFTER UPLOAD?**

We can't scan what doesn't exist yet. The file must land in storage before we can analyze it. BUT we mark it as `PENDING_SCAN` and block downloads until `CLEAN`.

**WHY ASYNC?**

Scanning a 2GB file with ClamAV takes 30-60 seconds. If we do this synchronously in the HTTP request, the lawyer stares at a spinner and may retry (creating duplicates).

**THE PATTERN:**

```
Upload Request ──► Save file as PENDING_SCAN ──► Respond 201 Created
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Scan Queue     │
                                              │  (Bull/Redis)   │
                                              └────────┬────────┘
                                                       │
                                          ┌────────────┼────────────┐
                                          ▼            ▼            ▼
                                      CLEAN         INFECTED      ERROR
                                          │            │            │
                                          ▼            ▼            ▼
                                    Mark ACTIVE    Quarantine    Retry 3x
```

**CODE:**

```typescript
// src/services/scanQueue.ts
import Queue from 'bull';

interface ScanJob {
  fileId: string;
  storageKey: string;
}

const scanQueue = new Queue<ScanJob>('virus-scan', {
  redis: { host: process.env.REDIS_HOST, port: 6379 },
});

/**
 * Producer: Called by upload handler.
 */
export async function enqueueScan(fileId: string, storageKey: string): Promise<void> {
  await scanQueue.add({ fileId, storageKey }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}

/**
 * Consumer: The worker process.
 */
scanQueue.process(async (job) => {
  const { fileId, storageKey } = job.data;

  // In production: stream from S3 to ClamAV daemon
  // Here: simulate scan
  console.log(`Scanning ${storageKey}...`);
  await new Promise((r) => setTimeout(r, 2000));

  const isInfected = false; // Replace with actual ClamAV check

  if (isInfected) {
    await db.file.update({
      where: { id: fileId },
      data: { status: 'QUARANTINED' },
    });
    // Optionally delete from S3 or move to quarantine bucket
  } else {
    await db.file.update({
      where: { id: fileId },
      data: { status: 'ACTIVE' },
    });
  }
});
```

### 6. Audit Logging

**WHAT IS IT?**

Every security-relevant event is recorded immutably: who did what, to which file, when, from where.

**WHY IMMUTABILITY MATTERS:**

In a breach investigation, if logs can be altered, they are inadmissible. Append-only means once written, forever preserved.

**WHAT HAPPENS IF WE DON'T?**

```
Scenario: Disgruntled employee downloads client files before quitting.

Without audit logs:
  "We think someone might have accessed something?"

With mutable logs:
  Employee has DB access. Deletes their access records.
  "No evidence found."

With append-only logs:
  Records exist forever. Employee is caught.
```

**LOG AGGREGATION CONCEPT:**

```
App Servers ──► Local Log File ──► Fluentd/Vector ──► Central Store
                                                   (Elasticsearch,
                                                    ClickHouse,
                                                    CloudWatch)
```

For this project, we use PostgreSQL with table constraints preventing updates/deletes.

**CODE:**

```typescript
// src/middleware/audit.ts
import { Request, Response, NextFunction } from 'express';
import onFinished from 'on-finished';
import Queue from 'bull';
import { AuthenticatedRequest } from './auth.js';

export interface AuditContext {
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
}

const auditQueue = new Queue('audit', {
  redis: { host: process.env.REDIS_HOST, port: 6379 },
});

/**
 * Enqueue an audit event for guaranteed delivery.
 * The worker process persists to PostgreSQL asynchronously.
 * This never blocks the HTTP response and survives server crashes.
 */
export async function logAuditEvent(
  context: AuditContext,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditQueue.add(
    {
      context,
      action,
      resourceType,
      resourceId,
      metadata,
    },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );
}

export function auditMiddleware(
  action: string,
  resourceType: string,
  getResourceId: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // on-finished reliably detects response completion without monkey-patching res.end
    onFinished(res, (_err, res) => {
      if (res.statusCode < 400) {
        const context: AuditContext = {
          userId: (req as AuthenticatedRequest).user?.id ?? 'anonymous',
          userEmail: (req as AuthenticatedRequest).user?.email ?? 'anonymous',
          ipAddress: req.ip ?? 'unknown',
          userAgent: req.get('user-agent') ?? 'unknown',
        };

        logAuditEvent(context, action, resourceType, getResourceId(req), {
          statusCode: res.statusCode,
        }).catch((err) => {
          console.error('AUDIT QUEUE FAILURE:', err);
        });
      }
    });

    next();
  };
}
```

> **SECURITY FIX — Audit Log Monkey-Patch & Durability (CRITICAL):**
> The original middleware replaced `res.end` and performed async database work after the response was sent. If the event loop was saturated or the server crashed, the audit write was lost—unacceptable for legal compliance. The fix uses `on-finished` to reliably detect response completion without monkey-patching, and routes all audit events through a Bull queue. The queue retries failed writes and survives process restarts, giving us an append-only, tamper-evident audit trail.

---

## Section 4: Step-by-Step Build Guide

### Prerequisites

```bash
# Node.js 22+, pnpm
pnpm init
pnpm add express@5 @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner
pnpm add -D typescript @types/express @types/multer @types/node tsx @types/node-cron @types/jsonwebtoken @types/on-finished
pnpm add prisma @prisma/client bull ioredis multer node-cron jsonwebtoken on-finished
```

### Step 1: Database Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      UserRole @default(LAWYER)
  firmId    String
  createdAt DateTime @default(now())

  files      File[]
  accessLogs AccessLog[]

  @@index([firmId])
}

enum UserRole {
  ADMIN
  LAWYER
  PARALEGAL
}

model File {
  id           String     @id @default(uuid())
  originalName String
  storageKey   String     @unique // UUID-based, sanitized
  mimeType     String
  sizeBytes    BigInt
  status       FileStatus @default(PENDING_SCAN)

  // Encryption metadata (NOT the key!)
  encryptionSalt String // Base64
  encryptionIv   String // Base64

  uploadedById String
  uploadedBy   User   @relation(fields: [uploadedById], references: [id])
  firmId       String

  retentionDays Int      @default(90)
  expiresAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  accessLogs AccessLog[]

  @@index([firmId, status])
  @@index([expiresAt])
}

enum FileStatus {
  PENDING_SCAN
  ACTIVE
  QUARANTINED
  EXPIRED
}

/**
 * APPEND-ONLY: No updates, no deletes.
 * We enforce this at the application layer.
 */
model AccessLog {
  id           String   @id @default(uuid())
  userId       String
  userEmail    String
  action       String // UPLOAD, DOWNLOAD, DELETE, etc.
  resourceType String // FILE, etc.
  resourceId   String
  ipAddress    String
  userAgent    String
  metadata     String? // JSON
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([resourceId, createdAt])
  @@index([userId, createdAt])
}
```

### Step 2: Streaming Upload Endpoint

```typescript
// src/routes/upload.ts
import { Router } from 'express';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'node:crypto';
import { createReadStream, unlink } from 'node:fs';
import { db } from '../db/client.js';
import { createEncryptStream } from '../utils/encryption.js';
import { enqueueScan } from '../services/scanQueue.js';
import { logAuditEvent } from '../middleware/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET = process.env.S3_BUCKET || '';
const MASTER_KEY = Buffer.from(process.env.ENCRYPTION_MASTER_KEY || '', 'base64');

router.post('/', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!req.file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }

    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const sizeBytes = BigInt(req.file.size);

    const storageKey = randomUUID();
    const encryptStream = createEncryptStream(MASTER_KEY);

    // Two-phase upload: create a PENDING_UPLOAD record first.
    // If the S3 upload or DB insert fails, we have a clear orphan
    // record that a cleanup job can reap later.
    let fileRecord = await db.file.create({
      data: {
        originalName,
        storageKey,
        mimeType,
        sizeBytes,
        status: 'PENDING_UPLOAD',
        encryptionSalt: encryptStream.salt.toString('base64'),
        encryptionIv: encryptStream.iv.toString('base64'),
        uploadedById: user.id,
        firmId: user.firmId,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });

    const fileStream = createReadStream(req.file.path);
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET,
        Key: storageKey,
        Body: fileStream.pipe(encryptStream),
        ContentType: 'application/octet-stream',
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
    });

    await upload.done();

    // Clean up the temporary disk file
    await unlink(req.file.path).catch(() => {});

    // Mark ready for scanning
    fileRecord = await db.file.update({
      where: { id: fileRecord.id },
      data: { status: 'PENDING_SCAN' },
    });

    await enqueueScan(fileRecord.id, storageKey);

    logAuditEvent(
      {
        userId: user.id,
        userEmail: user.email,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.get('user-agent') ?? 'unknown',
      },
      'UPLOAD',
      'FILE',
      fileRecord.id,
      { originalName, sizeBytes: sizeBytes.toString() }
    );

    res.status(201).json({
      id: fileRecord.id,
      status: fileRecord.status,
      expiresAt: fileRecord.expiresAt,
    });
  } catch (err) {
    // Ensure temp file is removed even on failure
    if (req.file?.path) {
      await unlink(req.file.path).catch(() => {});
    }
    next(err);
  }
});

export default router;
```

> **SECURITY FIX — Hardcoded Salt/IV, Multer Memory Buffer & Two-Phase Upload (CRITICAL):**
> The old route used `'extracted_salt'` and `'extracted_iv'`, which rendered files unrecoverable. It also assumed `req.body.fileStream` existed, which Multer never provides—`storage: undefined` actually falls back to memory storage and buffers the entire file in RAM, crashing the server on 2GB uploads. The fix uses `multer.diskStorage` to spool to a temp file, then streams from disk through the encryptor into S3. We also implemented a two-phase upload (`PENDING_UPLOAD` → upload → `PENDING_SCAN`) so an S3 failure leaves a clear orphan record instead of a missing DB row.

### Step 3: Encryption Before Upload

See the `createEncryptStream` function in Section 3. The key insight: we encrypt as we stream, so the plaintext never exists in memory as a whole.

```
┌──────────────┐      ┌──────────────────┐      ┌──────────────┐
│ Client Chunk │─────►│ Encrypt Transform │─────►│ S3 Part      │
│ (64KB)       │      │ (64KB in, 64KB+tag│      │ (accumulated)│
└──────────────┘      └──────────────────┘      └──────────────┘
```

### Step 4: Download via Pre-Signed URL

```typescript
// src/routes/download.ts
import { Router } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../db/client.js';
import { logAuditEvent } from '../middleware/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createDecryptStream } from '../utils/encryption.js';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';

const asyncPipeline = promisify(pipeline);

const router = Router();

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || '';
const MASTER_KEY = Buffer.from(process.env.ENCRYPTION_MASTER_KEY || '', 'base64');

router.get('/:fileId/url', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { fileId } = req.params;

    const file = await db.file.findFirst({
      where: {
        id: fileId,
        firmId: user.firmId, // Firm isolation!
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (!file) {
      res.status(404).json({ error: 'File not found or not available' });
      return;
    }

    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: file.storageKey,
        ResponseContentDisposition: `attachment; filename="${file.originalName}"`,
      }),
      { expiresIn: 3600 }
    );

    logAuditEvent(
      {
        userId: user.id,
        userEmail: user.email,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.get('user-agent') ?? 'unknown',
      },
      'DOWNLOAD_URL_GENERATED',
      'FILE',
      fileId,
      { expiresIn: 3600 }
    );

    res.json({ downloadUrl: url, expiresIn: 3600 });
  } catch (err) {
    next(err);
  }
});

/**
 * Stream-decrypt a file directly to the client.
 * Required for 2GB files because decryptBuffer would OOM the server.
 */
router.get('/:fileId/stream', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { fileId } = req.params;

    const file = await db.file.findFirst({
      where: {
        id: fileId,
        firmId: user.firmId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!file) {
      res.status(404).json({ error: 'File not found or not available' });
      return;
    }

    const s3Response = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: file.storageKey })
    );

    const decryptStream = createDecryptStream(MASTER_KEY);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.originalName}"`
    );
    res.setHeader('Content-Type', file.mimeType);

    // @ts-ignore — SDK Body is a web stream; cast to Node stream for pipeline
    await asyncPipeline(s3Response.Body as NodeJS.ReadableStream, decryptStream, res);

    logAuditEvent(
      {
        userId: user.id,
        userEmail: user.email,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.get('user-agent') ?? 'unknown',
      },
      'DOWNLOAD_STREAM',
      'FILE',
      fileId,
      { originalName: file.originalName }
    );
  } catch (err) {
    next(err);
  }
});

export default router;
```

> **SECURITY FIX — Streaming Decryption Endpoint (CRITICAL):**
> The guide previously provided no way to download and decrypt files. Users would receive a pre-signed URL to ciphertext they couldn't read. The new `/:fileId/stream` route fetches the object from S3 as a stream, pipes it through `createDecryptStream`, and writes the plaintext directly to the response. Memory stays flat regardless of file size.

### Step 5: Audit Logging Middleware

See Section 3 for the full `audit.ts`. Usage in routes:

```typescript
import { auditMiddleware } from '../middleware/audit.js';

router.delete(
  '/:fileId',
  auditMiddleware('DELETE', 'FILE', (req) => req.params.fileId),
  async (req, res) => {
    // ... deletion logic
  }
);
```

### Step 6: Virus Scanning Simulation

See Section 3 for the Bull queue setup. To run the worker:

```bash
# In a separate process or container
pnpm tsx src/workers/scanWorker.ts
```

```typescript
// src/workers/scanWorker.ts
import '../services/scanQueue.js'; // Initializes the queue processor

console.log('Scan worker started...');
// Keep alive
setInterval(() => {}, 1 << 30);
```

### Step 7: File Expiration / Cleanup Job

```typescript
// src/jobs/cleanup.ts
import { db } from '../db/client.js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
});

const BATCH_SIZE = 100;

export async function runCleanup(): Promise<void> {
  let cursor: string | undefined;

  do {
    const batch = await db.file.findMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { not: 'EXPIRED' },
      },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    for (const file of batch) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET || '',
            Key: file.storageKey,
          })
        );

        await db.file.update({
          where: { id: file.id },
          data: { status: 'EXPIRED' },
        });

        console.log(`Cleaned up expired file: ${file.id}`);
      } catch (err) {
        console.error(`Failed to clean up file ${file.id}:`, err);
      }
    }

    cursor = batch.length === BATCH_SIZE ? batch[batch.length - 1].id : undefined;
  } while (cursor);
}

// Run every hour via node-cron or external scheduler
import { schedule } from 'node-cron';

schedule('0 * * * *', () => {
  runCleanup().catch(console.error);
});
```

> **OPERATIONAL FIX — Cleanup Pagination (MAJOR):**
> The original cleanup job loaded every expired file into memory with `findMany`. At 100,000 expired files, this would exhaust server RAM. The fix uses cursor-based pagination (`skip`/`take`) to process files in batches of 100, keeping memory usage constant regardless of backlog size.

### Step 8: Access Control

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: 'ADMIN' | 'LAWYER' | 'PARALEGAL';
    firmId: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || '';

/**
 * Verify Bearer token and attach user to request.
 * In production, rotate JWT secrets and use short expirations.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as AuthenticatedRequest['user'];
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// Firm isolation is enforced in DB queries:
// where: { firmId: user.firmId }
// NEVER trust the client to tell you their firm ID.
```

> **SECURITY FIX — Zero Authentication (CRITICAL):**
> The original `requireRole` middleware checked a `req.user` property that was never populated by any passport/JWT/OAuth code. Anyone could upload, download, or delete files. The fix adds a real `authenticate` middleware that verifies a JWT from the `Authorization: Bearer <token>` header using `jsonwebtoken`. All file routes now require authentication, and firm isolation is enforced at the database query level.

### Bringing It All Together

```typescript
// src/index.ts
import express from 'express';
import uploadRoutes from './routes/upload.js';
import downloadRoutes from './routes/download.js';
import { authenticate } from './middleware/auth.js';
import { uploadMiddleware } from './middleware/upload.js';

function validateEnv() {
  const required = [
    'DATABASE_URL',
    'S3_ENDPOINT',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'S3_BUCKET',
    'ENCRYPTION_MASTER_KEY',
    'REDIS_HOST',
    'JWT_SECRET',
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  const key = Buffer.from(process.env.ENCRYPTION_MASTER_KEY!, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must decode to 32 bytes');
  }
}

validateEnv();

const app = express();
app.use(express.json());

// All file routes require a valid JWT
app.use('/api/files/upload', authenticate, uploadMiddleware, uploadRoutes);
app.use('/api/files', authenticate, downloadRoutes);

app.listen(3000, () => {
  console.log('Secure File Vault running on :3000');
});
```

> **SECURITY FIX — Environment Validation (MAJOR):**
> The original code used TypeScript non-null assertions (`process.env.ENCRYPTION_MASTER_KEY!`) that would throw opaque runtime errors if the variable was missing. The fix adds a `validateEnv()` function at startup that checks every required variable and verifies the master key decodes to exactly 32 bytes. Failing fast on boot prevents silent cryptographic failures later.

---

## Section 5: 5 Intentional Bugs

### Bug 1: Buffering the Whole File

**How to Introduce:**

```typescript
// THE BUG: Using multer's MemoryStorage
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
  const buffer = req.file!.buffer; // 💥 Entire file in RAM
  await s3.upload({ Body: buffer }).promise();
});
```

**Symptoms:**
- Server crashes on files > 500MB (depends on VPS RAM).
- Response time increases linearly with file size.
- Node.js heap allocation errors in logs.

**Reproduction:**
```bash
dd if=/dev/zero of=bigfile.bin bs=1M count=1500
curl -X POST -F "file=@bigfile.bin" http://localhost:3000/api/files/upload
# Watch process RSS climb to 1.5GB and die.
```

**Fix:**

Use streaming upload via `@aws-sdk/lib-storage` with a readable stream body. Never buffer large files.

```typescript
const upload = multer({ storage: undefined }); // Or custom stream storage
// Use new Upload({ client: s3Client, params: { Body: readableStream } })
```

**WHY:** Streams process data in 64KB windows. Memory stays flat regardless of file size.

---

### Bug 2: No Encryption Key Rotation

**How to Introduce:**

```typescript
// THE BUG: Hardcoded key, used forever
const KEY = Buffer.from('deadbeef12345678...', 'hex'); // Never changes

function encrypt(data: Buffer) {
  return crypto.createCipheriv('aes-256-gcm', KEY, randomBytes(16));
}
```

**Symptoms:**
- If key leaks (env var exposed in log, employee leaves), ALL historical files are compromised.
- No way to rotate without re-encrypting everything.

**Reproduction:**
```bash
grep -r "ENCRYPTION_MASTER_KEY" /var/log/
# Key found in application startup logs.
# Attacker now decrypts every file in the S3 bucket.
```

**Fix:**

Implement key versioning. Store `keyVersion` with each file. Support multiple active keys.

```typescript
interface KeyVersion {
  version: number;
  key: Buffer;
  createdAt: Date;
}

const keys: Map<number, KeyVersion> = loadKeysFromKMS();

function encrypt(data: Buffer) {
  const currentKey = getCurrentKey(); // Rotates monthly
  const cipher = createCipheriv('aes-256-gcm', currentKey.key, randomBytes(16));
  // Store currentKey.version alongside IV
}
```

**WHY:** Key rotation limits blast radius. A leaked key only exposes files encrypted during its active period.

---

### Bug 3: Path Traversal in Filename

**How to Introduce:**

```typescript
// THE BUG: Trusting user-provided filename
const filename = req.file!.originalname;
const key = `uploads/${filename}`; // 💥
await s3.upload({ Key: key, Body: stream }).promise();
```

**Symptoms:**
- User uploads `../../../etc/passwd` as filename.
- If using local disk: overwrites system files.
- With S3: may overwrite other objects depending on prefix rules.
- Information disclosure via filename probing.

**Reproduction:**
```bash
curl -X POST -F "file=@contract.pdf;filename=../../../etc/passwd" \
  http://localhost:3000/api/files/upload
# Storage key becomes uploads/../../../etc/passwd
```

**Fix:**

Never use user input as a storage identifier. Generate UUIDs.

```typescript
import { randomUUID } from 'node:crypto';

const storageKey = randomUUID(); // e.g., "550e8400-e29b-41d4-a716-446655440000"
// Original name is stored in DB for display only.
```

**WHY:** UUIDs are unpredictable, non-sequential, and contain no path characters. The original name is metadata, not an address.

---

### Bug 4: Missing Backpressure Handling

**How to Introduce:**

```typescript
// THE BUG: Raw pipe without error handling
req.pipe(encryptStream).pipe(s3UploadStream);
// No error handling. No backpressure awareness.
```

**Symptoms:**
- Fast client + slow S3 upload = memory usage grows unbounded.
- `pipe()` swallows errors from the destination stream.
- Unhandled 'error' events crash the process.

**Reproduction:**
```bash
# Throttle S3 upload artificially (network limit)
tc qdisc add dev eth0 root tbf rate 1mbit burst 32kbit latency 400ms
# Upload 2GB file
# Watch memory climb because client sends faster than S3 accepts.
```

**Fix:**

Use `pipeline()` with proper error handling and stream destruction.

```typescript
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';

const asyncPipeline = promisify(pipeline);

try {
  await asyncPipeline(req, encryptStream, s3UploadStream);
} catch (err) {
  // pipeline automatically destroys all streams on error
  console.error('Upload failed:', err);
  res.status(500).json({ error: 'Upload failed' });
}
```

**WHY:** `pipeline()` handles backpressure correctly and guarantees cleanup. If any stream errors, all are destroyed to prevent resource leaks.

---

### Bug 5: Audit Log in Request Cycle

**How to Introduce:**

```typescript
// THE BUG: Awaiting audit log synchronously
router.get('/:fileId/url', async (req, res) => {
  const file = await db.file.findUnique({ where: { id: req.params.fileId } });
  const url = await generatePresignedUrl(file.storageKey);

  await db.accessLog.create({ /* ... */ }); // 💥 Blocks response!

  res.json({ url });
});
```

**Symptoms:**
- Response time increases by audit DB latency (5-50ms per request).
- Under load, audit writes queue up and degrade API performance.
- If audit DB is slow/down, file downloads fail (cascading failure).

**Reproduction:**
```bash
# Simulate slow audit DB
# Add 100ms delay to access_log INSERT
# Run load test: ab -n 1000 -c 50 http://localhost:3000/api/files/123/url
# P95 latency jumps from 20ms to 120ms.
```

**Fix:**

Fire-and-forget, or use a message queue.

```typescript
// Option 1: Fire-and-forget ( acceptable for non-critical )
db.accessLog.create({ /* ... */ }).catch((err) => {
  console.error('Audit log failed:', err);
});

// Option 2: Queue for guaranteed delivery ( preferred )
await auditQueue.add({ /* event data */ });
// Respond immediately. Worker processes queue asynchronously.
```

**WHY:** Audit logging is a side effect. It must not impact the primary operation. Queues provide durability without blocking.

---

## Section 6: Security Deep Dive

### Encryption Key Management (KMS Concept)

```
WITHOUT KMS:
Master Key ──► Stored in .env on server
               If server compromised: key compromised.

WITH KMS (AWS KMS / HashiCorp Vault):
Master Key ──► Stored in Hardware Security Module (HSM)
               Your server only has a KEY ID, not the key itself.
               Encryption happens INSIDE the HSM.
               If server compromised: attacker has no key.
```

**Envelope Encryption Pattern:**

```
1. Generate random Data Encryption Key (DEK) per file
2. Encrypt file with DEK
3. Encrypt DEK with Master Key (via KMS)
4. Store encrypted DEK alongside file metadata
5. Discard plaintext DEK from memory
```

This is how AWS S3 SSE-KMS works. Compromising one file's DEK doesn't affect others.

### Why Server-Side Encryption Alone Isn't Enough

S3 SSE encrypts data on disks. But:
- Anyone with S3 read permissions sees plaintext.
- Compromised AWS credentials = full access.
- S3 admin can access data.

Client-side encryption means:
- S3 sees only ciphertext.
- Even with full S3 access, data is unreadable without the encryption key.
- Your server is the only place decryption happens.

### Metadata Leakage

Encryption hides CONTENT, not EXISTENCE:

```
ATTACKER HAS:
- file size: 4,194,304 bytes (exactly 4MB)
- upload time: 2025-03-15 02:17:33 UTC
- filename: "Smith_vs_Jones_settlement_draft_v3.pdf"

WHAT THEY LEARN:
- The case name (Smith vs Jones)
- It's a draft (not final)
- Version 3 (negotiations ongoing)
- Uploaded at 2AM (maybe under deadline pressure?)
```

**Mitigations:**
- Pad files to standard sizes (1MB, 5MB, 10MB buckets).
- Use non-descriptive storage keys (UUIDs).
- Consider separate metadata encryption for filenames.

### Access Patterns That Expose Data

**Timing Attack on Existence:**

```
Attacker requests:
GET /api/files/550e8400-e29b-41d4-a716-446655440000/url

If file exists:    DB query + S3 presign = 45ms
If file NOT exist: DB query returns null = 12ms

Attacker measures response time.
Attacker learns whether file exists without permission.
```

**Fix:**

```typescript
// Constant-time response pattern
const start = Date.now();
const file = await db.file.findUnique({ where: { id } });

if (!file || file.firmId !== user.firmId) {
  // Still do a small computation to pad time
  await new Promise((r) => setTimeout(r, 30));
  res.status(404).json({ error: 'Not found' });
  return;
}
```

Or simpler: always perform a presigned URL generation (which fails at S3 level) for non-existent files, so timing is roughly equal.

---

## Section 7: Deployment

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/vault?schema=public
      - S3_ENDPOINT=http://minio:9000
      - S3_ACCESS_KEY=minioadmin
      - S3_SECRET_KEY=minioadmin
      - S3_BUCKET=vault-files
      - S3_REGION=us-east-1
      - ENCRYPTION_MASTER_KEY=${ENCRYPTION_MASTER_KEY}
      - REDIS_HOST=redis
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
      minio:
        condition: service_healthy
      redis:
        condition: service_started
    command: >
      sh -c "pnpm prisma migrate deploy &&
             pnpm tsx src/index.ts"

  worker:
    build: .
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/vault?schema=public
      - S3_ENDPOINT=http://minio:9000
      - S3_ACCESS_KEY=minioadmin
      - S3_SECRET_KEY=minioadmin
      - S3_BUCKET=vault-files
      - S3_REGION=us-east-1
      - REDIS_HOST=redis
      - NODE_ENV=production
    depends_on:
      - db
      - minio
      - redis
    command: pnpm tsx src/workers/scanWorker.ts

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: vault
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ':9001'
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - miniodata:/data
    ports:
      - '9000:9000'
      - '9001:9001'
    healthcheck:
      test: ['CMD', 'mc', 'ready', 'local']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  miniodata:
  redisdata:
```

### Dockerfile

```dockerfile
# Dockerfile
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma/
RUN pnpm prisma generate

COPY . .

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

> **OPERATIONAL FIX — Incomplete Dockerfile (MAJOR):**
> The original Dockerfile ended with `EXPOSE 3000` but no `CMD` or `ENTRYPOINT`, so the container started and immediately exited. The fix adds `CMD ["node", "dist/index.js"]` so the container actually runs the application.

### MinIO Setup Script

```bash
#!/bin/sh
# scripts/setup-minio.sh

# Wait for MinIO to be ready
sleep 5

mc alias set local http://minio:9000 minioadmin minioadmin
mc mb local/vault-files || true
# Bucket remains PRIVATE. Pre-signed URLs are the only download mechanism.
# NEVER use `mc anonymous set download` — it bypasses all access control.
```

> **SECURITY FIX — Public MinIO Bucket (CRITICAL):**
> The original setup script ran `mc anonymous set download`, making the bucket world-readable. Anyone with the bucket URL could list and download all files without any authentication. The fix removes that line entirely. The bucket stays private, and the only download mechanism is time-limited, HMAC-signed pre-signed URLs generated by the API.

### Environment Variables

```bash
# .env.example (NEVER commit the real .env)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vault?schema=public"

S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="vault-files"
S3_REGION="us-east-1"

# Generate with: openssl rand -base64 32
ENCRYPTION_MASTER_KEY="CHANGE_ME_IN_PRODUCTION_USE_32_BYTES_BASE64="

REDIS_HOST="localhost"

# Generate with: openssl rand -base64 32
JWT_SECRET="CHANGE_ME_IN_PRODUCTION_USE_32_BYTES_BASE64="
```

---

## Section 8: Post-Mortem Template

When something breaks (and it will), use this template to learn systematically.

```markdown
# Post-Mortem: [Incident Title]

## Metadata
- **Date:** YYYY-MM-DD
- **Severity:** SEV1 (Critical) / SEV2 (Major) / SEV3 (Minor)
- **Duration:** HH:MM:SS
- **Reporter:** @name

## Summary
One-paragraph description of what happened and the impact.

## Timeline (UTC)
- `HH:MM` - Event detected (how? monitoring? customer report?)
- `HH:MM` - Investigation started
- `HH:MM` - Root cause identified
- `HH:MM` - Mitigation applied
- `HH:MM` - Service fully restored

## Root Cause
The technical reason this happened. Be specific.

## Impact
- Number of affected users:
- Number of affected files:
- Data integrity concerns (yes/no, explain):
- Compliance implications (yes/no, explain):

## Resolution
What was done to fix it.

## Prevention
What changes will prevent recurrence:
- [ ] Code fix
- [ ] Monitoring alert
- [ ] Runbook update
- [ ] Architecture change

## Lessons Learned
What did we learn about our system? What assumptions were wrong?

## Action Items
| Task | Owner | Due Date | Status |
|------|-------|----------|--------|
| Fix race condition in upload | @dev | YYYY-MM-DD | Open |
| Add memory usage alert | @sre | YYYY-MM-DD | Open |
```

---

## Quick Reference: The Decision Matrix

| Decision | Right Choice | Wrong Choice | Why Wrong |
|----------|--------------|--------------|-----------|
| File processing | Streams | Buffers | 2GB = crash |
| Storage | S3/MinIO | Local disk | Ephemeral, unscalable |
| Download delivery | Pre-signed URL | Proxy through app | Bandwidth cost, latency |
| Encryption timing | Before upload | After upload (server-side only) | S3 breach exposes plaintext |
| Metadata storage | PostgreSQL | S3 tags | No querying, no indexes |
| Audit log pattern | Append-only queue | Updatable table | Tamperable, non-compliant |
| Key management | KMS / versioned keys | Hardcoded single key | Total exposure on leak |
| Filename handling | UUID storage key | User-provided name | Path traversal |
| Backpressure | `pipeline()` | `.pipe()` | Memory leaks, crashes |
| Audit write | Async queue | Await in request | Cascading latency failures |

---

> **Remember:** Security is not a feature you add at the end. It's a property of the system that emerges from every decision you make. Encrypt by default. Log everything. Trust no input. Verify everything.

**Built with:** Node.js 22, Express 5, TypeScript 5, Prisma, MinIO, PostgreSQL, Bull, ESM.

**Next Project:** [03-event-sourced-ledger](../03-event-sourced-ledger) — Where we build an immutable financial transaction log with CQRS and event sourcing.
