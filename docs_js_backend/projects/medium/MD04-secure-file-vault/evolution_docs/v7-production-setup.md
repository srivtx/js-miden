# MD04 Secure File Vault — v7 Production Setup

Your file vault works. It has types, validation, logs, tests, and ESM. But file storage at scale is a distributed systems challenge involving encryption, access control, and massive data volumes. One misconfiguration and you leak customer data.

## Pain #1: Local Disk Fills Up

You store files on the server disk. At 10GB/day, the 100GB disk fills in 10 days. You add a bigger disk. It fills too. You can't scale vertically forever.

**Evolution: Local Disk → S3 + Metadata in PostgreSQL**

```prisma
// prisma/schema.prisma
model FileUpload {
  id            String   @id @default(uuid())
  filename      String
  originalName  String
  contentType   String
  size          Int
  ownerId       String
  storageKey    String   // S3 object key
  checksum      String   // SHA-256 of plaintext
  encryptedKey  String   // Encrypted data key ( envelope encryption )
  uploadedAt    DateTime @default(now())
  deletedAt     DateTime?

  accessLogs    FileAccessLog[]
  signedUrls    SignedUrl[]

  @@index([ownerId, uploadedAt])
  @@index([storageKey])
}

model FileAccessLog {
  id        String   @id @default(uuid())
  fileId    String
  userId    String
  action    String   // upload, download, share, delete
  ip        String
  timestamp DateTime @default(now())

  file FileUpload @relation(fields: [fileId], references: [id])

  @@index([fileId, timestamp])
  @@index([timestamp])
}

model SignedUrl {
  id        String   @id @default(uuid())
  fileId    String
  token     String   @unique
  expiresAt DateTime
  createdBy String
  createdAt DateTime @default(now())

  file FileUpload @relation(fields: [fileId], references: [id])

  @@index([token])
  @@index([expiresAt])
}
```

Files live in S3. Metadata lives in PostgreSQL. You can have infinite storage.

## Pain #2: Encryption Key Management

You encrypt every file with the same hardcoded key. An attacker gets the key. Every file is compromised. You can't rotate the key without re-encrypting everything.

**Evolution: Hardcoded Key → Envelope Encryption with KMS**

```ts
// src/crypto/envelopeEncryption.ts
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: process.env.AWS_REGION });

export interface EncryptedDataKey {
  ciphertext: Buffer;
  algorithm: string;
}

export async function generateDataKey(): Promise<{ plaintext: Buffer; encrypted: EncryptedDataKey }> {
  const command = new GenerateDataKeyCommand({
    KeyId: process.env.KMS_KEY_ID,
    KeySpec: 'AES_256',
  });

  const response = await kms.send(command);
  return {
    plaintext: response.Plaintext as Buffer,
    encrypted: {
      ciphertext: response.CiphertextBlob as Buffer,
      algorithm: 'AES-256-GCM',
    },
  };
}

export async function decryptDataKey(encrypted: EncryptedDataKey): Promise<Buffer> {
  const command = new DecryptCommand({
    CiphertextBlob: encrypted.ciphertext,
    KeyId: process.env.KMS_KEY_ID,
  });

  const response = await kms.send(command);
  return response.Plaintext as Buffer;
}
```

```ts
// Encryption flow
async function encryptFile(plaintext: Readable): Promise<{ ciphertext: Readable; encryptedKey: EncryptedDataKey }> {
  const { plaintext: dataKey, encrypted } = await generateDataKey();

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);

  // Stream encryption
  const ciphertext = plaintext.pipe(cipher);

  return {
    ciphertext,
    encryptedKey: encrypted,
  };
}
```

Each file gets a unique data key. The data key is encrypted by KMS. To decrypt a file, you need:
1. Access to KMS (IAM role)
2. The encrypted data key from PostgreSQL
3. The ciphertext from S3

Rotate the KMS key? Only re-encrypt the data keys (small), not the files (large).

## Pain #3: Streaming Large Files

A user uploads a 2GB video. Your server buffers it in memory. It crashes. Even if it survives, the HTTP connection times out after 30 seconds.

**Evolution: Buffer → Streaming**

```ts
// src/services/fileVaultService.ts
import { Upload } from '@aws-sdk/lib-storage';
import { PassThrough } from 'stream';

async function upload(
  stream: Readable,
  meta: UploadMeta,
  ownerId: string
): Promise<FileUpload> {
  const fileId = crypto.randomUUID();
  const storageKey = `uploads/${fileId.slice(0, 2)}/${fileId.slice(2, 4)}/${fileId}`;

  // Encrypt stream
  const { plaintext: dataKey, encrypted } = await generateDataKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);

  const encryptedStream = stream.pipe(cipher);

  // Upload to S3 in parts (handles 2GB+ files)
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
      Body: encryptedStream,
      ContentType: meta.contentType,
      ServerSideEncryption: 'AES256',
    },
  });

  await upload.done();

  // Store metadata
  const file = await prisma.fileUpload.create({
    data: {
      id: fileId,
      filename: sanitizeFilename(meta.filename),
      originalName: meta.filename,
      contentType: meta.contentType,
      size: meta.size,
      ownerId,
      storageKey,
      checksum: await computeStreamChecksum(stream), // computed before encryption
      encryptedKey: JSON.stringify(encrypted),
    },
  });

  // Clear data key from memory
  dataKey.fill(0);

  return file;
}
```

Memory usage stays flat regardless of file size. S3 handles multipart upload retry logic.

## Pain #4: Signed URLs with Fine-Grained Control

A user wants to share a file with a client for 24 hours. You generate a URL. But anyone with the URL can download it. You can't revoke it. You can't limit it to one download.

**Evolution: Basic Signed URL → Token-Based Signed URLs**

```ts
// src/services/signedUrlService.ts
import { createHmac, randomBytes } from 'crypto';

export class SignedUrlService {
  async createSignedUrl(
    fileId: string,
    createdBy: string,
    options: {
      expiresInMinutes: number;
      maxDownloads?: number;
      allowedIPs?: string[];
    }
  ): Promise<SignedUrl> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + options.expiresInMinutes * 60000);

    const signedUrl = await prisma.signedUrl.create({
      data: {
        fileId,
        token,
        expiresAt,
        createdBy,
        maxDownloads: options.maxDownloads,
        allowedIPs: options.allowedIPs,
      },
    });

    return {
      url: `${process.env.BASE_URL}/s/${token}`,
      expiresAt,
    };
  }

  async validateSignedUrl(token: string, ip: string): Promise<FileUpload> {
    const signed = await prisma.signedUrl.findUnique({
      where: { token },
      include: { file: true },
    });

    if (!signed) throw new Error('Invalid token');
    if (signed.expiresAt < new Date()) throw new Error('Expired');
    if (signed.maxDownloads && signed.downloadCount >= signed.maxDownloads) {
      throw new Error('Download limit reached');
    }
    if (signed.allowedIPs && !signed.allowedIPs.includes(ip)) {
      throw new Error('IP not allowed');
    }

    // Increment download count
    await prisma.signedUrl.update({
      where: { id: signed.id },
      data: { downloadCount: { increment: 1 } },
    });

    return signed.file;
  }
}
```

Signed URLs support:
- Expiration
- Download limits
- IP restrictions
- Revocation (delete from DB)

## Pain #5: Architecture Spaghetti

Your route handler validates uploads, encrypts streams, writes to S3, inserts metadata, logs access, and generates signed URLs. It's 500 lines.

**Evolution: Monolith → Layered → Service-Based**

```
┌─────────────────┐
│   API Routes    │  ← HTTP, auth
├─────────────────┤
│  Vault Service  │  ← Orchestration
├─────────────────┤
│  File Repo      │  ← PostgreSQL (Prisma)
│  Storage Layer  │  ← S3 abstraction
│  Crypto Service │  ← Encryption/decryption
│  Signed URL     │  ← Token management
│  Audit Logger   │  ← Immutable logs
├─────────────────┤
│      S3         │  ← Object storage
│   PostgreSQL    │  ← Metadata + audit
└─────────────────┘
```

```ts
// src/services/fileVaultService.ts
export class FileVaultService {
  constructor(
    private fileRepo: IFileRepository,
    private storage: IStorageProvider,
    private crypto: ICryptoService,
    private signedUrlService: ISignedUrlService,
    private auditLogger: IAuditLogger,
  ) {}

  async upload(stream: Readable, meta: UploadMeta, ownerId: string): Promise<FileUpload> {
    const { encryptedStream, encryptedKey } = await this.crypto.encrypt(stream);
    const storageKey = await this.storage.upload(encryptedStream);

    const file = await this.fileRepo.create({
      ...meta,
      ownerId,
      storageKey,
      encryptedKey,
    });

    await this.auditLogger.log({ action: 'upload', fileId: file.id, userId: ownerId });
    return file;
  }

  async download(fileId: string, userId: string): Promise<Readable> {
    const file = await this.fileRepo.findById(fileId);
    if (file.ownerId !== userId) throw new Error('Unauthorized');

    const encryptedStream = await this.storage.download(file.storageKey);
    const dataKey = await this.crypto.decryptDataKey(file.encryptedKey);

    await this.auditLogger.log({ action: 'download', fileId, userId });

    return this.crypto.decryptStream(encryptedStream, dataKey);
  }
}
```

## Pain #6: Audit Logs in the Same Database

An attacker gains DB access. They delete the audit logs. You have no record of the breach. Compliance fails.

**Evolution: Same DB → Immutable External Store**

```ts
// src/audit/externalAuditLogger.ts
export class ExternalAuditLogger {
  async log(entry: AuditEntry): Promise<void> {
    // Write to PostgreSQL (fast, queryable)
    await prisma.auditLog.create({ data: entry });

    // Ship to immutable store (compliance)
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AUDIT_BUCKET,
      Key: `audit/${entry.timestamp.toISOString().slice(0, 10)}/${entry.id}.json`,
      Body: JSON.stringify(entry),
      ChecksumAlgorithm: 'SHA256',
    }));

    // Send to SIEM (real-time alerting)
    await siemClient.index({
      index: 'file-vault-audit',
      body: entry,
    });
  }
}
```

Three copies:
1. PostgreSQL: fast queries, 30-day retention
2. S3 with Object Lock: immutable, 7-year retention
3. SIEM: real-time alerting, anomaly detection

## Final Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Gateway │────▶│   Express   │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
              ┌─────────────────────────────────┼─────────────────────────────────┐
              │                                 │                                 │
        ┌─────▼─────┐                   ┌───────▼────────┐                 ┌──────▼─────┐
        │   Vault   │                   │    Crypto      │                 │   Audit    │
        │  Service  │                   │   Service      │                 │  Logger    │
        └─────┬─────┘                   └───────┬────────┘                 └──────┬─────┘
              │                                 │                                 │
        ┌─────▼─────┐                   ┌───────▼────────┐                 ┌──────▼─────┐
        │ PostgreSQL │                   │      AWS       │                 │    S3      │
        │ (Metadata) │                   │      KMS       │                 │  (Immutable│
        └────────────┘                   └────────────────┘                 │   Audit)   │
              │                                                                  └────────────┘
        ┌─────▼─────┐
        │    S3     │
        │ (Files)   │
        └───────────┘
```

## Production Checklist

- [ ] S3 for object storage with server-side encryption
- [ ] PostgreSQL with Prisma for metadata
- [ ] Envelope encryption with AWS KMS
- [ ] Streaming upload/download (no memory pressure)
- [ ] Signed URLs with expiration, limits, IP restrictions
- [ ] Immutable audit trail (S3 Object Lock + SIEM)
- [ ] Layered architecture (routes → services → repos)
- [ ] File integrity verification (SHA-256 checksums)
- [ ] Connection pooling (PgBouncer)
- [ ] S3 multipart upload for large files

This is a production secure file vault. It started as raw disk storage. Now it uses envelope encryption, streams terabyte-scale files, and maintains tamper-proof audit trails.
