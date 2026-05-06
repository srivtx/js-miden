# MD04 Secure File Vault — v6 Switching to ESM

## The Problem

You're trying to use `aws-sdk` v3 for S3 integration. It's ESM-first.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module @aws-sdk/client-s3 not supported
```

You could use AWS SDK v2 (CommonJS), but v3 has better tree-shaking, modular packages, and TypeScript support. v2 is also in maintenance mode.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest"
  }
}
```

```ts
// src/storage/s3Storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Storage {
  private client = new S3Client({ region: process.env.AWS_REGION });

  async upload(key: string, stream: Readable, size: number): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: stream,
      ContentLength: size,
      ServerSideEncryption: 'AES256',
    }));
  }

  async getSignedDownloadUrl(key: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
```

```ts
// src/index.ts
import express from 'express';
import { FileVaultService } from './services/fileVaultService.js';
import { S3Storage } from './storage/s3Storage.js';
import { PostgresFileRepository } from './repos/postgresFileRepo.js';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const vault = new FileVaultService(
  new PostgresFileRepository(prisma),
  new S3Storage(),
);
```

## Why ESM Matters for This Project

### 1. Streaming Works Better

```ts
import { Upload } from '@aws-sdk/lib-storage';

const upload = new Upload({
  client: this.client,
  params: {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: stream,
  },
});

await upload.done();
```

AWS SDK v3's `Upload` handles multipart streaming. ESM imports make the types work seamlessly.

### 2. Top-Level Await for Key Loading

```ts
// src/crypto/encryption.ts
import { readFile } from 'node:fs/promises';

const masterKey = await readFile(process.env.ENCRYPTION_KEY_PATH!);
export { masterKey };
```

No more `readFileSync`. Clean async initialization.

### 3. Conditional Environment Imports

```ts
const storage = process.env.STORAGE_BACKEND === 's3'
  ? new S3Storage()
  : await import('./storage/localStorage.js').then(m => new m.LocalStorage());
```

## Migration Checklist

- [ ] Add `"type": "module"` to `package.json`
- [ ] Use `.js` extensions in imports
- [ ] Use `node:` prefix for built-ins
- [ ] Update `tsconfig.json` for `NodeNext`
- [ ] Switch test runner to Vitest

## The Bug

You switch to ESM. Your Docker build breaks because `tsc` outputs `.js` but your Dockerfile copies `.ts` files and runs `ts-node`.

**Fix:** Build first, then run.

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .
CMD ["node", "dist/index.js"]
```

**Next:** Production setup with S3, encryption at rest, and audit logging.
