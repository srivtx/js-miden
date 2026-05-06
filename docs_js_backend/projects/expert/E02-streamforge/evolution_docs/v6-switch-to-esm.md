# v6 — Switch to ESM

Your streaming platform has tests, but CommonJS `require()` is causing issues across 4 services. Dynamic mocks are unreliable. Bundle sizes are large. Async service initialization is awkward.

## Pain #1: Redis Client Import Issues

```javascript
// CommonJS
const { createClient } = require('redis');
// Redis v4+ is ESM-first. require() sometimes returns { default: ... }
// You need: const { createClient } = require('redis').default;
// This breaks when the library updates.
```

The transcode service crashes on startup because `createClient` is undefined. The Redis client changed its export structure.

## Pain #2: No Streaming Import for HLS

```javascript
// CommonJS
const fs = require('fs');
const path = require('path');
```

You want to use the new `node:fs/promises` API and `ReadableStream`. In CommonJS, mixing promises and streams is verbose. ESM makes it natural.

## Pain #3: Service Startup Sequencing

```javascript
// CommonJS — can't await at top level
const redis = require('./redis');
(async function() {
  await redis.connect();
  module.exports = { redis };
})();
```

Other files `require('./redis')` before the connection is ready. They get an unconnected client. Race conditions abound.

## The Fix: ESM Migration

### package.json

```json
{
  "type": "module",
  "scripts": {
    "dev:ingest": "tsx watch src/ingest/index.ts",
    "dev:transcode": "tsx watch src/transcode/index.ts",
    "dev:chat": "tsx watch src/chat/index.ts",
    "dev:analytics": "tsx watch src/analytics/index.ts",
    "build": "tsc",
    "test": "vitest"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Service Entry Points

```typescript
// src/ingest/index.ts
import express from 'express';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { StartStreamSchema } from '@shared/validation/stream.js';
import { logger } from '@shared/utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Top-level await for connections
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/streamforge_ingest');

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
await redis.connect();

app.use(express.json());

app.post('/streams/start', authenticate, validateBody(StartStreamSchema), async (req, res) => {
  const { channelId, title } = req.body;
  const streamKey = uuidv4();
  
  logger.info({ streamKey, channelId, userId: req.user.id }, 'Stream started');
  
  const stream = await Stream.create({
    streamKey,
    userId: req.user.id,
    channelId,
    title,
    status: 'live',
    startedAt: new Date(),
    rtmpUrl: `rtmp://localhost:1935/live/${streamKey}`,
  });
  
  await redis.publish('stream:start', JSON.stringify({
    streamKey,
    channelId,
    rtmpUrl: stream.rtmpUrl,
  }));
  
  res.status(201).json({ stream });
});

app.listen(PORT, () => {
  logger.info(`Ingest Service running on port ${PORT}`);
});
```

```typescript
// src/transcode/index.ts
import { createClient } from 'redis';
import { logger } from '@shared/utils/logger.js';

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
await redis.connect();

redis.subscribe('stream:start', async (message) => {
  const data = JSON.parse(message);
  logger.info({ streamKey: data.streamKey }, 'Starting transcode');
  // ...
});
```

## What Changed

1. **Redis imports** — Direct `import { createClient } from 'redis'`. No `.default` hacks.
2. **Top-level await** — Services connect to databases before handling requests.
3. **Shared types** — `@shared/validation/stream.js` imports work consistently.
4. **Modern streams** — `node:fs/promises` and web streams are available.

## ESM for Microservices

In a multi-service architecture, ESM provides consistency. Every service uses the same module system. Shared packages import cleanly. There are no "works in ingest but breaks in transcode" module issues.

## Next Pain

Services start but there's no graceful shutdown. Redis connections are dropped mid-publish. Active streams are killed on deploy. You need production setup.
