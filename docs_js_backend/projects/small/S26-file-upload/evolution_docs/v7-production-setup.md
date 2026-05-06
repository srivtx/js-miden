# v7-production-setup

## Goal
Run a secure, scalable upload service with virus scanning, streaming, image processing, and multi-backend storage.

## Changes
1. **Streaming uploads** — `multer` streams to temp; validate magic numbers from the first chunk without full write.
2. **Virus scan** — `clamscan` or cloud API (`scanFile` stub replaced with real ClamAV socket).
3. **Image processing** — `sharp` generates thumbnails and watermarked variants.
4. **S3 storage** — `S3Storage` implementation with presigned URLs for retrieval.
5. **Rate limiting** — `express-rate-limit` per IP (100 requests / 15 min).
6. **Helmet** — Security headers.
7. **Graceful shutdown** — Drain active uploads before exit.
8. **Structured logs** — `pino` shipped to stdout for container environments.

## Code

```ts
// src/services/scan.ts
import NodeClam from 'clamscan';

const clamscan = await new NodeClam().init({
  clamdscan: { socket: process.env.CLAMAV_SOCKET || '/tmp/clamd.sock' },
});

export async function scanFile(filePath: string): Promise<ScanResult> {
  const { isInfected } = await clamscan.isInfected(filePath);
  return { clean: !isInfected, threats: isInfected ? ['virus'] : undefined };
}
```

```ts
// src/services/image.ts
import sharp from 'sharp';

export async function processImage(filePath: string) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  await sharp(filePath)
    .resize(200, 200, { fit: 'cover' })
    .toFile(path.join(dir, `${base}_thumb${ext}`));

  await sharp(filePath)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .composite([
      { input: Buffer.from('<svg><text x="10" y="20" fill="white">WATERMARK</text></svg>'), gravity: 'southeast' }
    ])
    .toFile(path.join(dir, `${base}_resized${ext}`));
}
```

```ts
// src/index.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

## Decisions
- **ClamAV unix socket** is faster than TCP and avoids network overhead in containers.
- **Sharp** runs in a libuv thread pool — does not block the event loop.
- **S3 presigned URLs** for retrieval keep the app stateless; no proxying large files through Node.

## Risks
- Image processing on the main app server consumes CPU. Offload to a job queue (S28) for high traffic.
- Virus scan on large files (>100 MB) can time out. Stream scan or set generous timeouts.

## ASCII: Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Express    │────▶│   Local     │
│             │     │  Rate Limit  │     │   Temp      │
└─────────────┘     └──────────────┘     └─────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
      ┌──────────┐     ┌──────────┐     ┌──────────┐
      │  Magic   │     │  ClamAV  │     │  Sharp   │
      │  Number  │     │  Scan    │     │ Process  │
      └──────────┘     └──────────┘     └──────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  S3 / Local  │
                       │   Storage    │
                       └──────────────┘
```
