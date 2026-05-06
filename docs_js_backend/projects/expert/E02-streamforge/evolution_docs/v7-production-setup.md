# v7 — Production Setup

Your streaming platform works locally. But production streaming has unique requirements: zero-downtime deploys, stream continuity, CDN integration, and DMCA compliance. A deploy can't kill active broadcasts.

## Pain #1: Deploys Kill Live Streams

```typescript
// transcode/index.ts
app.listen(PORT, () => console.log('Transcode on', PORT));
// SIGTERM kills the process. Active transcodes die mid-segment.
// Viewers see buffering, then "stream offline."
// The broadcaster has to restart OBS.
```

A rolling update during prime time kills 50 active streams. Streamers rage on Twitter.

## Pain #2: No Stream Continuity

```typescript
// HLS segments are served from local disk
app.use('/streams', express.static(STORAGE_PATH));
// On restart, the new pod has no segments.
// Viewers get 404 on playlist requests.
```

Transcoded segments are local to each pod. A new pod can't serve old segments. The stream stutters or dies.

## Pain #3: Chat Message Loss on Reconnect

```typescript
// chat/index.ts
ws.on('connection', (ws) => {
  ws.on('message', (msg) => {
    broadcast(msg);
  });
});
// No message persistence. No history on reconnect.
// A viewer refreshes and misses the last 50 messages.
```

Chat is purely in-memory. Viewers reconnecting see an empty chat. Moderation actions (bans, timeouts) are lost on server restart.

## Pain #4: No CDN Integration

```typescript
// All HLS requests hit the transcode service directly
app.get('/playlist/:channelId/:streamKey', (req, res) => {
  res.sendFile(path.join(STORAGE_PATH, ...));
});
// 10,000 viewers = 10,000 requests to one pod.
// The pod dies under load.
```

No CDN caching. No edge distribution. Viewers in Australia request segments from a US server. Latency is 300ms.

## The Fix: Production Streaming Architecture

### Graceful Shutdown with Stream Draining

```typescript
// src/transcode/index.ts
import { setupGracefulShutdown } from '@shared/utils/server.js';

const server = app.listen(PORT, () => {
  logger.info(`Transcode service on port ${PORT}`);
});

setupGracefulShutdown(server, async () => {
  logger.info('Draining active transcodes...');
  
  // Stop accepting new streams
  redis.unsubscribe('stream:start');
  
  // Wait for active transcodes to finish current segment
  await Promise.all(
    activeTranscodes.map(t => t.waitForCurrentSegment())
  );
  
  // Upload final segments to S3
  await uploadRemainingSegments();
  
  await redis.disconnect();
  logger.info('Transcode drained');
});
```

### Shared Storage for Stream Continuity

```typescript
// src/transcode/storage.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function uploadSegment(
  channelId: string,
  streamKey: string,
  quality: string,
  segmentName: string,
  data: Buffer
) {
  const key = `streams/${channelId}/${streamKey}/${quality}/${segmentName}`;
  
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: data,
    ContentType: segmentName.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : 'video/MP2T',
    CacheControl: segmentName.endsWith('.m3u8')
      ? 'max-age=2' // Playlists are short-lived
      : 'max-age=31536000', // Segments are immutable
  }));
  
  return `https://${process.env.CDN_DOMAIN}/${key}`;
}
```

### Chat Persistence with Redis Streams

```typescript
// src/chat/persistence.ts
import { redis } from '@shared/utils/redis.js';

const CHAT_HISTORY_LIMIT = 100;
const CHAT_STREAM_KEY = (channelId: string) => `chat:${channelId}`;

export async function persistMessage(channelId: string, message: ChatMessage) {
  await redis.xAdd(CHAT_STREAM_KEY(channelId), '*', {
    id: message.id,
    username: message.username,
    message: message.message,
    timestamp: message.timestamp.toString(),
  });
  
  // Trim to last 100 messages
  await redis.xTrim(CHAT_STREAM_KEY(channelId), 'MAXLEN', CHAT_HISTORY_LIMIT);
}

export async function getChatHistory(channelId: string, count: number = 50): Promise<ChatMessage[]> {
  const entries = await redis.xRevRange(CHAT_STREAM_KEY(channelId), '+', '-', { COUNT: count });
  
  return entries.map(entry => ({
    id: entry.message.id,
    username: entry.message.username,
    message: entry.message.message,
    timestamp: new Date(parseInt(entry.message.timestamp)),
  }));
}
```

```typescript
// src/chat/index.ts
wss.on('connection', async (ws, req) => {
  const channelId = new URL(req.url!, 'http://localhost').searchParams.get('channel') || 'unknown';
  
  // Send recent history on connect
  const history = await getChatHistory(channelId);
  ws.send(JSON.stringify({ type: 'history', messages: history }));
  
  ws.on('message', async (raw) => {
    const message = parseChatMessage(raw);
    await persistMessage(channelId, message);
    broadcast(channelId, message);
  });
});
```

### CDN-Optimized Playlist Serving

```typescript
// src/transcode/index.ts
app.get('/playlist/:channelId/:streamKey', async (req, res) => {
  const { channelId, streamKey } = req.params;
  
  // Serve playlist with CDN-aware segment URLs
  const playlist = await generateMasterPlaylist(channelId, streamKey, {
    baseUrl: `https://${process.env.CDN_DOMAIN}/streams/${channelId}/${streamKey}`,
  });
  
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'max-age=2, stale-while-revalidate=1');
  res.send(playlist);
});
```

## What Changed

1. **Zero-downtime deploys** — Active transcodes drain before shutdown.
2. **Stream continuity** — Segments are stored in S3, not local disk.
3. **Chat persistence** — Redis Streams retain message history across reconnects.
4. **CDN distribution** — Segments are cached at edge. Origin load drops 99%.

## Production Checklist

- [ ] Graceful shutdown with stream draining
- [ ] Shared storage (S3) for segments
- [ ] CDN integration for HLS delivery
- [ ] Chat persistence (Redis Streams)
- [ ] Real-time metrics (viewer counts, bitrate)
- [ ] DMCA/content moderation hooks
- [ ] Geographic stream distribution
- [ ] Auto-scaling transcode workers
- [ ] Stream health monitoring
- [ ] Backup ingest endpoints

## The Evolution

| Stage | State |
|-------|-------|
| v1 | Base64 upload, static serving |
| v2 | TypeScript types for cross-service events |
| v3 | Validation for stream config and chat |
| v4 | Structured logging for stream debugging |
| v5 | Tests for transcode, chat, and analytics |
| v6 | ESM for modern streaming libraries |
| v7 | Production streaming with CDN, persistence, and resilience |

This is a production streaming platform. It handles live broadcasts, adaptive bitrate, real-time chat, and analytics. It started as a file uploader. Now it's a Twitch-scale backend.
