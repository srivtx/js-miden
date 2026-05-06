# v2 — Adding TypeScript

The streaming platform works, but every service refactor is a minefield. You change the stream event shape and the transcode service crashes. You rename a field and the analytics dashboard shows blank cells.

## Pain: Runtime Type Errors

```js
// Ingest service
app.post('/streams/start', async (req, res) => {
  const { channelId, title } = req.body;
  // req.body might have 'channelID' (capital D)
  // No error until Redis publish fails
  await redis.publish('stream:start', JSON.stringify({
    streamKey,
    channelId,
    title,
  }));
});

// Transcode service receives:
redis.subscribe('stream:start', async (message) => {
  const data = JSON.parse(message);
  // data.channelId is undefined because ingest sent channelID
  console.log(data.channelId); // undefined
});
```

A new engineer adds `bitrate` to the stream metadata but forgets to update the transcode job interface. The transcode service silently ignores it and produces low-quality segments.

## Solution: Shared Types + Strict TS

```typescript
// shared/types/stream.ts
export interface Stream {
  streamKey: string;
  userId: string;
  channelId: string;
  title: string;
  status: 'live' | 'offline' | 'ended';
  startedAt?: Date;
  endedAt?: Date;
  rtmpUrl: string;
  qualities: StreamQuality[];
}

export interface StreamQuality {
  resolution: '360p' | '480p' | '720p' | '1080p';
  bitrate: number;
  codec: 'h264' | 'av1';
}

export interface TranscodeJob {
  streamKey: string;
  channelId: string;
  rtmpUrl: string;
  qualities: StreamQuality[];
}

export interface ChatMessage {
  id: string;
  channelId: string;
  username: string;
  message: string;
  timestamp: Date;
}
```

Now cross-service communication is typed:

```typescript
// Ingest service
const job: TranscodeJob = {
  streamKey: data.streamKey,
  channelId: data.channelId,
  rtmpUrl: data.rtmpUrl,
  qualities: defaultQualities, // Type-safe
};

// ERROR if you forget a field or use wrong type
await redis.publish('stream:start', JSON.stringify(job));
```

## The Multi-Service Benefit

With 4 services (ingest, transcode, chat, analytics), TypeScript is the glue. When the `Stream` interface changes, all services fail to compile until they're updated. The type system enforces cross-service contracts.

**Trade-off:** Monorepo complexity or package publishing. But shared types prevent the most expensive bugs: silent data corruption across service boundaries.

## What Changed

| Before (JS) | After (TS) |
|-------------|------------|
| `JSON.parse()` returns `any` | `JSON.parse()` is cast to known interface |
| Field renames break silently | Field renames fail at compile time |
| No IDE help for Redis messages | Autocomplete for event payloads |
| Services drift out of sync | Type checker keeps contracts aligned |

## Next Pain

Types describe structure but don't enforce it at the edge. A user can POST `{ channelId: 123, title: null }` and TypeScript won't reject it. You need validation.
