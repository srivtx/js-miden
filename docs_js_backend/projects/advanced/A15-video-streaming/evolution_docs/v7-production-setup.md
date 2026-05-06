# v7 — Production Setup (Video Streaming)

## The Scenario

It's 2am. Your junior deploys the video server to production. "It works!" they say. Then the container restarts. All video metadata vanishes. All upload sessions are lost. "But it was working..." they whimper. You check: local filesystem storage. No CDN. No transcoding pipeline. Every deploy resets the content library.

## The PAIN: Development Data Is Not Production Data

From v6:

```typescript
const videos: Video[] = []; // In-memory. Ephemeral. Dead on restart.
// Video files stored on local disk. Lost on redeploy.
```

Local development can survive data loss. Production cannot. Content creators upload videos. Users expect them to play. A streaming platform without persistent storage is just a file server.

### The evolution of persistence in this project:

| Version | Storage | Data survives restart? |
|---------|---------|----------------------|
| v1 | In-memory arrays + local disk | ❌ No |
| v2 | In-memory arrays + local disk | ❌ No |
| v3 | In-memory arrays + local disk | ❌ No |
| v4 | In-memory arrays + local disk | ❌ No |
| v5 | In-memory arrays + local disk | ❌ No |
| v6 | In-memory arrays + local disk | ❌ No |
| v7 | PostgreSQL + S3 + CDN | ✓ Production-ready |

## The Solution: PostgreSQL + S3 + CDN + Production Patterns

### 1. Database Schema (PostgreSQL)

```sql
-- migrations/001_initial.sql
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL,
  format VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  storage_key VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stream_variants (
  id UUID PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES videos(id),
  quality INTEGER NOT NULL,
  bitrate INTEGER NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  codec VARCHAR(50) NOT NULL
);

CREATE TABLE watch_history (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  video_id UUID NOT NULL REFERENCES videos(id),
  progress_seconds INTEGER NOT NULL DEFAULT 0,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_history_user ON watch_history(user_id, watched_at);
```

Why PostgreSQL?
- **ACID transactions**: Video metadata updates are atomic
- **JSONB**: Flexible variant storage
- **Concurrent access**: Row-level locking prevents race conditions
- **Durability**: Write-ahead logging survives crashes

### 2. S3 for Object Storage

```typescript
// src/services/upload.service.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function uploadToS3(key: string, buffer: Buffer): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'video/mp4',
  }));
  return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
}
```

Why S3?
- **Durability**: 99.999999999% (11 nines) durability
- **Scalability**: Unlimited storage
- **CDN integration**: CloudFront origin

### 3. CDN for Delivery

```typescript
// src/services/cdn.service.ts
export function getCdnUrl(storageKey: string): string {
  return `${process.env.CDN_BASE_URL}/${storageKey}`;
}

export function setCacheHeaders(res: Response, maxAge: number): void {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
  res.setHeader('CDN-Cache-Control', `public, max-age=${maxAge}`);
}
```

Why CDN?
- **Global edge caching**: Sub-50ms latency worldwide
- **Origin shield**: Reduces origin load by 90%
- **Bandwidth savings**: Cache hits don't hit your server

### 4. Environment Configuration

```bash
# .env.example
DATABASE_URL="postgresql://user:pass@localhost:5432/streaming?schema=public"
S3_BUCKET="my-video-bucket"
AWS_REGION="us-east-1"
CDN_BASE_URL="https://d1234.cloudfront.net"
REDIS_URL="redis://localhost:6379"
PORT=3000
LOG_LEVEL=info
```

### 5. Production Routes (connecting to src/)

```typescript
// src/routes/video.routes.ts (actual production code)
import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  duration: z.number().int().positive().max(86400),
  format: z.enum(['mp4', 'mov', 'mkv', 'avi']),
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = createSchema.parse(req.body);
    const storageKey = `uploads/${crypto.randomUUID()}.${parsed.format}`;

    const result = await pool.query(
      `INSERT INTO videos (id, title, description, duration, format, status, storage_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'uploading', $6, NOW(), NOW()) RETURNING *`,
      [crypto.randomUUID(), parsed.title, parsed.description, parsed.duration, parsed.format, storageKey]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});
```

### 6. The Range Request Fix (Documented)

```typescript
// src/middleware/range-request.middleware.ts
export function validateRange(range: string, fileSize: number): { start: number; end: number } | null {
  const match = range.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null;

  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024, fileSize - 1);

  if (start >= fileSize || start < 0 || end >= fileSize || end < start) {
    return null;
  }

  const maxRangeSize = 1024 * 1024; // 1MB max
  if (end - start + 1 > maxRangeSize) {
    end = start + maxRangeSize - 1;
  }

  return { start, end };
}
```

This fix clamps range requests to 1MB and validates bounds. The DoS vulnerability is eliminated.

### 7. Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:migrate": "node-pg-migrate up",
    "transcode": "tsx scripts/transcode.ts"
  }
}
```

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Persistence | In-memory arrays | PostgreSQL with WAL |
| File storage | Local disk | S3 (11 nines durability) |
| Delivery | Direct origin | CDN with edge caching |
| Validation | None | Zod schemas |
| Types | None | TypeScript + generated types |
| Testing | None | Vitest + mocked services |
| Logging | console.log | Structured Pino |
| Module system | CommonJS | ESM |
| Range requests | Unvalidated | Clamped to 1MB |

## The Realization

> Junior: "I connected to S3 and suddenly videos survive restarts. Then I realized: every layer we added — types, validation, tests, ESM — was necessary to get here without breaking everything."
>
> You: "Production isn't one big change. It's seven small evolutions, each fixing the pain of the last. The array taught us persistence matters. The local disk taught us scale matters. S3 + CDN is where all those lessons converge. In streaming, latency is measured in user abandonment."

## Files in this project

```
A15-video-streaming/
├── src/
│   ├── index.ts              # Entry point (ESM)
│   ├── app.ts                # Express app setup
│   ├── routes/
│   │   ├── video.routes.ts     # Video CRUD
│   │   ├── stream.routes.ts    # HLS/DASH serving
│   │   ├── upload.routes.ts    # Multipart upload
│   │   └── history.routes.ts   # Watch history
│   ├── services/
│   │   ├── video.service.ts    # Video metadata
│   │   ├── stream.service.ts   # Range request handling
│   │   ├── upload.service.ts   # S3 upload
│   │   ├── transcode.service.ts # FFmpeg pipeline
│   │   ├── cdn.service.ts      # Cache headers
│   │   └── history.service.ts  # Progress tracking
│   ├── middleware/
│   │   ├── range-request.middleware.ts # Validated ranges
│   │   └── rate-limit.middleware.ts    # Upload throttling
│   ├── utils/
│   │   └── logger.ts           # Pino structured logging
│   └── types/
│       ├── video.types.ts
│       └── stream.types.ts
├── migrations/                 # PostgreSQL migrations
├── .env.example
├── docker-compose.yml          # PostgreSQL + Redis + Nginx
├── package.json                # ESM, scripts, dependencies
└── tsconfig.json               # NodeNext module resolution
```

## What You Learned

1. **Persistence evolution**: array → PostgreSQL + S3. Each step taught a lesson.
2. **CDN is non-negotiable**: Without it, your origin dies at scale.
3. **Tests document bugs**: The range request test proves the DoS vulnerability is fixed.
4. **ESM is the future**: `"type": "module"` isn't a preference, it's a requirement for modern packages.
5. **Adaptive bitrate**: One video file is not enough. You need 1080p, 720p, 480p, and 360p variants.
