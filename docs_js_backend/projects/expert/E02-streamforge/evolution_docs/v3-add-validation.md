# v3 — Add Validation

Your streaming platform accepts raw JSON from OBS, chat clients, and analytics collectors. Without validation, malformed payloads crash services and corrupt the broadcast pipeline.

## Pain #1: Invalid Stream Configurations

```typescript
// ingest/index.ts
app.post('/streams/start', async (req, res) => {
  const { channelId, title } = req.body;
  // No validation. channelId might be a number, an object, or missing.
  const streamKey = uuidv4();
  const stream = await Stream.create({
    streamKey,
    userId: req.body.userId || 'anonymous',
    channelId,
    title,
  });
});
```

A bot sends `{ channelId: { $ne: null } }`. MongoDB stores a query object. The transcode service crashes trying to read `data.channelId.length`.

## Pain #2: Chat Message Abuse

```typescript
// chat/index.ts
ws.on('message', (data) => {
  const message = JSON.parse(data);
  broadcast(message.channelId, {
    username: message.username,
    message: message.message,
  });
});
```

A troll sends `{ username: 'admin', message: '<script>alert("xss")</script>' }`. No validation. No sanitization. The message is broadcast to all viewers.

## Pain #3: Analytics Data Corruption

```typescript
// analytics/index.ts
app.post('/viewers/join', async (req, res) => {
  const { channelId, streamKey, viewerId } = req.body;
  // viewerId might be missing. channelId might be an array.
  await ViewerCount.increment(channelId, 1);
});
```

Missing `viewerId` means deduplication fails. The same viewer joins 50 times. Viewer counts are inflated by 5000%.

## The Fix: Zod Validation at Every Boundary

```typescript
// shared/src/validation/stream.ts
import { z } from 'zod';

export const StartStreamSchema = z.object({
  channelId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string().min(1).max(200),
});

export const EndStreamSchema = z.object({
  streamKey: z.string().uuid(),
});

export const ChatMessageSchema = z.object({
  channelId: z.string().min(1),
  username: z.string().min(1).max(50).regex(/^[\w\s-]+$/),
  message: z.string().min(1).max(500),
});

export const ViewerEventSchema = z.object({
  channelId: z.string().min(1),
  streamKey: z.string().uuid(),
  viewerId: z.string().min(1),
  event: z.enum(['join', 'leave']),
});
```

```typescript
// ingest/index.ts
import { StartStreamSchema } from '@shared/validation/stream.js';

app.post('/streams/start', authenticate, validateBody(StartStreamSchema), async (req, res) => {
  const { channelId, title } = req.body;
  // channelId is guaranteed to be a valid string
  const streamKey = uuidv4();
  const stream = await Stream.create({
    streamKey,
    userId: req.user.id,
    channelId,
    title,
  });
  // ...
});
```

```typescript
// chat/index.ts
import { ChatMessageSchema } from '@shared/validation/stream.js';

ws.on('message', (raw) => {
  let data: unknown;
  try {
    data = JSON.parse(raw.toString());
  } catch {
    return ws.send(JSON.stringify({ error: 'Invalid JSON' }));
  }

  const result = ChatMessageSchema.safeParse(data);
  if (!result.success) {
    return ws.send(JSON.stringify({ error: 'Invalid message format' }));
  }

  const message = result.data;
  broadcast(message.channelId, {
    username: sanitizeHtml(message.username),
    message: sanitizeHtml(message.message),
    timestamp: Date.now(),
  });
});
```

## What Changed

1. **Stream integrity** — `channelId` must match `[a-zA-Z0-9_-]+`. No injection.
2. **Chat safety** — usernames and messages are validated and sanitized.
3. **Analytics accuracy** — `viewerId` is required. Deduplication works.
4. **Cross-service trust** — every service validates before acting.

## Validation as Broadcast Protection

In a streaming platform, one bad message can reach thousands of viewers. Validation at the edge is the difference between a blocked troll and a platform-wide XSS attack.

## Next Pain

When the transcode service crashes, you don't know why. Logs are `console.log` scattered across files. You need structured logging.
