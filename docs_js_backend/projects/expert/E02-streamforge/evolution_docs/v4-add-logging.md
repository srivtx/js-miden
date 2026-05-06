# v4 — Add Logging

Your streaming platform has 4 services: ingest, transcode, chat, analytics. When a stream fails, logs are scattered across all four. You have no way to correlate a stream start event with its transcode failure or its chat disconnect.

## Pain #1: Stream Failures Without Context

```typescript
// transcode/index.ts (before)
redis.subscribe('stream:start', async (message) => {
  const data = JSON.parse(message);
  console.log('Starting transcode for stream:', data.streamKey);
  try {
    await processTranscode(data);
  } catch (error) {
    console.error('Transcode failed', error);
  }
});
```

A transcode fails. The log says `"Transcode failed"` with a generic error. You don't know:
- Which stream key
- Which channel
- Which user started it
- How long it had been running
- What the input RTMP URL was

## Pain #2: Chat Abuse Without Attribution

```typescript
// chat/index.ts (before)
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('Chat message:', msg.username, msg.message);
  broadcast(msg.channelId, msg);
});
```

A user spams hate speech. The log shows the message but not:
- The WebSocket connection ID
- The user's authenticated identity
- The timestamp with millisecond precision
- Previous messages from the same connection

## Pain #3: Analytics Data Loss

```typescript
// analytics/index.ts (before)
app.post('/viewers/join', async (req, res) => {
  console.log('Viewer joined', req.body.channelId);
  await ViewerCount.increment(req.body.channelId, 1);
});
```

Viewer counts are wrong. The logs say viewers joined but don't show:
- The viewer ID (for deduplication)
- The stream key (for attribution)
- The previous count (for debugging race conditions)
- Whether the increment succeeded or failed

## The Fix: Structured Logging with Pino

```typescript
// shared/src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createStreamLogger(streamKey: string, channelId: string) {
  return logger.child({ streamKey, channelId, context: 'stream' });
}

export function createChatLogger(channelId: string, connectionId: string) {
  return logger.child({ channelId, connectionId, context: 'chat' });
}
```

```typescript
// transcode/index.ts
import { logger, createStreamLogger } from '@shared/utils/logger.js';

redis.subscribe('stream:start', async (message) => {
  const data = JSON.parse(message);
  const log = createStreamLogger(data.streamKey, data.channelId);
  
  log.info({ rtmpUrl: data.rtmpUrl }, 'Starting transcode job');
  
  try {
    const startTime = Date.now();
    await processTranscode(data);
    log.info({ durationMs: Date.now() - startTime }, 'Transcode completed');
  } catch (error: any) {
    log.error({ err: error, rtmpUrl: data.rtmpUrl }, 'Transcode failed');
    // Notify analytics of failure
    await redis.publish('stream:error', JSON.stringify({
      streamKey: data.streamKey,
      error: error.message,
    }));
  }
});
```

```typescript
// chat/index.ts
import { logger, createChatLogger } from '@shared/utils/logger.js';

wss.on('connection', (ws, req) => {
  const connectionId = crypto.randomUUID();
  const channelId = new URL(req.url!, 'http://localhost').searchParams.get('channel') || 'unknown';
  const log = createChatLogger(channelId, connectionId);
  
  log.info('Chat connection established');
  
  ws.on('message', (raw) => {
    const result = ChatMessageSchema.safeParse(JSON.parse(raw.toString()));
    if (!result.success) {
      log.warn({ errors: result.error.issues }, 'Invalid chat message received');
      return;
    }
    
    const msg = result.data;
    log.info({ username: msg.username, messageLength: msg.message.length }, 'Chat message broadcast');
    broadcast(channelId, msg);
  });
  
  ws.on('close', () => {
    log.info('Chat connection closed');
  });
});
```

## Log Output Example

```json
{
  "level": 30,
  "time": "2025-01-15T14:32:10.456Z",
  "service": "transcode",
  "version": "1.2.0",
  "streamKey": "stream_abc123",
  "channelId": "channel_456",
  "context": "stream",
  "durationMs": 2345,
  "msg": "Transcode completed"
}
```

## What Changed

1. **Stream correlation** — Every log includes `streamKey` and `channelId`.
2. **Chat attribution** — Every message is tied to a `connectionId`.
3. **Performance tracking** — Transcode duration is logged.
4. **Error context** — Failures include full input data (excluding secrets).

## Logging as Stream Debugging

In live streaming, failures happen in real-time. A broadcaster's stream dies and they tweet about it within seconds. Structured logging lets you find the root cause before the tweet goes viral.

## Next Pain

Logging shows you failures, but you find them in production. A chat refactor breaks message ordering and you only know because users complain. You need automated tests.
