# v4 — Add Logging (Video Streaming)

## The Scenario

It's 2am. A live stream is failing. Your junior stares at the console: "The last thing I see is `Video server running on port 3000`. Then nothing." Users report buffering. You check the logs. There are no logs. Just console output that vanished when the CDN origin restarted.

## The PAIN: Console.log Is Not Logging

From v3:

```typescript
app.post('/videos', async (req, res, next) => {
  try {
    const parsed = createVideoSchema.parse(req.body);
    const video = await createVideo(parsed);
    console.log('Created video:', video.id); // <-- This is not logging
    res.status(201).json(video);
  } catch (err) {
    console.error('Error:', err); // <-- This is also not logging
    next(err);
  }
});
```

### What breaks in production:

1. **No persistence**: `console.log` goes to stdout. Docker swallows it. Kubernetes rotates it. When the origin restarts, logs are gone. You can't investigate the buffering.

2. **No context**: `"Error: [object Object]"` — you logged an Error object with console.log. The stack trace is gone. You can't debug the transcoding failure.

3. **No levels**: Every message is the same priority. A video upload notification and a fatal crash look identical.

4. **No structure**: `"Created video: abc123"` — good luck parsing that in your log aggregator. You need JSON for log aggregation.

5. **No request tracing**: A user reports "my upload failed at 99%." Which request? Which upload session? Which chunk? You have no correlation ID.

## The Solution: Structured Logging with Pino

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  // In production: output JSON for log aggregators
  // In dev: pretty print for humans
});
```

```typescript
// src/routes/upload.routes.ts
import { logger } from '../utils/logger.js';

app.post('/videos', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /videos', userId: req.userId });

  try {
    childLogger.info({ body: req.body }, 'Creating video');
    const parsed = createVideoSchema.parse(req.body);

    const video = await createVideo(parsed);
    childLogger.info({ videoId: video.id, title: video.title }, 'Video created');

    res.status(201).json(video);
  } catch (err) {
    childLogger.error({ err, body: req.body }, 'Failed to create video');
    next(err);
  }
});
```

### Production log output:

```json
{
  "level": 30,
  "time": 1715000000000,
  "pid": 42,
  "hostname": "video-origin-pod-7f8d9",
  "requestId": "abc-123-def",
  "route": "POST /videos",
  "userId": "user-42",
  "videoId": "vid-789",
  "title": "Demo",
  "msg": "Video created"
}
```

### What structured logging gives you:

| Need | console.log | Pino |
|------|------------|------|
| Persist logs | ❌ Vanishes on restart | ✓ Writes to file/stdout (Docker/ELK captures) |
| Parse in log aggregator | ❌ String grep | ✓ JSON fields |
| Filter by level | ❌ All mixed | ✓ `level >= 40` for errors only |
| Trace requests | ❌ Manual grep | ✓ `requestId` correlation |
| Performance | ❌ Synchronous (blocks event loop) | ✓ Asynchronous (buffered) |

## The PAIN of Silent Failures

```typescript
// Without logging:
app.get('/stream/:id', async (req, res) => {
  const stream = await getStream(req.params.id);
  stream.pipe(res);
  // Which variant was served? What was the bitrate? Cache hit or miss? You'll never know.
});

// With logging:
app.get('/stream/:id', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'GET /stream/:id', videoId: req.params.id });

  try {
    childLogger.info({ range: req.headers.range }, 'Serving stream');
    const stream = await getStream(req.params.id);
    childLogger.info({ variant: stream.quality, cacheHit: stream.fromCache }, 'Stream served');
    stream.pipe(res);
  } catch (err) {
    childLogger.error({ err, videoId: req.params.id }, 'Failed to serve stream');
    next(err);
  }
});
```

## Logging Evolution in Video Streaming

| Version | Logging | Visibility |
|---------|---------|------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral, unstructured |
| v3 (Zod) | console.log | Same problems |
| v4 (Pino) | Structured, async, leveled | Full observability |

## The Realization

> Junior: "I added Pino and suddenly I can see exactly which stream failed, what the bitrate was, and the full error stack. In JSON."
>
> You: "Logs are your flight recorder. When a user reports buffering at 3am during a live event, logs are the only witness. Console.log is a Post-it note. Pino is a black box."

## The Next PAIN

Logging tells you what broke. But you find out **after** it breaks. What if we could catch regressions **before** deployment? What if we could prove the range request parser doesn't allow arbitrary byte ranges?

## Next: v5 — Add Testing
