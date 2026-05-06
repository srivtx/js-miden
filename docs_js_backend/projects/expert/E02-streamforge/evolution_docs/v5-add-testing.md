# v5 — Add Testing

Your streaming platform has logging, but you catch transcode failures in production. A chat refactor breaks message ordering. An analytics change inflates viewer counts. You have no safety net.

## Pain #1: Transcode Regressions

You update FFmpeg parameters for better quality. The change works for 1080p but breaks 360p playlists. Streams on mobile don't load. You only find out when mobile viewers complain.

## Pain #2: Chat Race Conditions

You optimize chat broadcasting for lower latency. But the new code doesn't preserve message order. Two messages sent in sequence arrive reversed. Moderators see context-free spam.

## Pain #3: Viewer Count Inflation

You refactor analytics to batch database writes. But the batching logic double-counts viewers who reconnect quickly. Peak viewer counts are inflated by 200%. Sponsors question the numbers.

## The Fix: Layered Testing Strategy

### Unit Tests: Service Logic

```typescript
// tests/unit/transcode.test.ts
import { describe, it, expect } from 'vitest';
import { generatePlaylist, QUALITIES } from '../../src/transcode/playlist.js';

describe('HLS Playlist Generation', () => {
  it('should generate valid master playlist with all qualities', () => {
    const master = generateMasterPlaylist(QUALITIES);
    
    expect(master).toContain('#EXTM3U');
    expect(master).toContain('#EXT-X-STREAM-INF');
    expect(master).toContain('1080p/playlist.m3u8');
    expect(master).toContain('720p/playlist.m3u8');
    expect(master).toContain('480p/playlist.m3u8');
    expect(master).toContain('360p/playlist.m3u8');
  });
  
  it('should include bandwidth attributes for adaptive bitrate', () => {
    const master = generateMasterPlaylist(QUALITIES);
    
    // Bandwidth must be present for HLS player to choose quality
    const bandwidthMatches = master.match(/BANDWIDTH=\d+/g);
    expect(bandwidthMatches).toHaveLength(QUALITIES.length);
  });
  
  it('should generate valid segment playlist', () => {
    const playlist = generateSegmentPlaylist([
      { duration: 6.0, filename: 'segment_0.ts' },
      { duration: 6.0, filename: 'segment_1.ts' },
    ]);
    
    expect(playlist).toContain('#EXT-X-TARGETDURATION:6');
    expect(playlist).toContain('#EXTINF:6.000,');
    expect(playlist).toContain('segment_0.ts');
    expect(playlist).toContain('#EXT-X-ENDLIST');
  });
});
```

### Integration Tests: Cross-Service Events

```typescript
// tests/integration/stream-lifecycle.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServices } from '../helpers/test-services.js';
import { createRedisClient } from '../helpers/redis.js';

let services: any;
let redis: any;

describe('Stream lifecycle', () => {
  beforeAll(async () => {
    services = await setupTestServices();
    redis = await createRedisClient();
  });
  
  afterAll(async () => {
    await services.cleanup();
    await redis.disconnect();
  });
  
  it('should trigger transcode on stream start', async () => {
    // Start a stream via ingest service
    const stream = await services.ingest.post('/streams/start', {
      channelId: 'test-channel',
      title: 'Test Stream',
    });
    
    // Wait for transcode to receive the event
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify transcode generated playlists
    const playlistResponse = await services.transcode.get(
      `/playlist/${stream.channelId}/${stream.streamKey}`
    );
    expect(playlistResponse.status).toBe(200);
    expect(playlistResponse.headers['content-type']).toBe('application/vnd.apple.mpegurl');
  });
  
  it('should end stream and cleanup', async () => {
    const stream = await services.ingest.post('/streams/start', {
      channelId: 'test-channel',
      title: 'Test Stream',
    });
    
    await services.ingest.post(`/streams/${stream.streamKey}/end`);
    
    const streamStatus = await services.ingest.get(`/streams/${stream.channelId}`);
    expect(streamStatus.status).toBe(404); // No active stream
  });
});
```

### Unit Tests: Chat Message Ordering

```typescript
// tests/unit/chat.test.ts
import { describe, it, expect } from 'vitest';
import { ChatRoom } from '../../src/chat/room.js';

describe('Chat message ordering', () => {
  it('should preserve message order within a channel', () => {
    const room = new ChatRoom('channel-1');
    
    room.broadcast({ id: 'msg-1', text: 'First' });
    room.broadcast({ id: 'msg-2', text: 'Second' });
    room.broadcast({ id: 'msg-3', text: 'Third' });
    
    const history = room.getHistory();
    expect(history[0].id).toBe('msg-1');
    expect(history[1].id).toBe('msg-2');
    expect(history[2].id).toBe('msg-3');
  });
  
  it('should enforce rate limiting per user', () => {
    const room = new ChatRoom('channel-1');
    const userId = 'user-123';
    
    // Send 10 messages rapidly
    for (let i = 0; i < 10; i++) {
      room.broadcast({ id: `msg-${i}`, userId, text: 'Spam' });
    }
    
    // 11th message should be rejected
    expect(() => {
      room.broadcast({ id: 'msg-11', userId, text: 'Spam' });
    }).toThrow('Rate limit exceeded');
  });
});
```

### Integration Tests: Viewer Count Accuracy

```typescript
// tests/integration/analytics.test.ts
import { describe, it, expect } from 'vitest';
import { ViewerCounter } from '../../src/analytics/counter.js';

describe('Viewer count accuracy', () => {
  it('should not double-count reconnecting viewers', async () => {
    const counter = new ViewerCounter();
    const viewerId = 'viewer-123';
    const channelId = 'channel-1';
    
    // Viewer joins
    await counter.join(channelId, viewerId);
    expect(await counter.getCount(channelId)).toBe(1);
    
    // Viewer leaves
    await counter.leave(channelId, viewerId);
    expect(await counter.getCount(channelId)).toBe(0);
    
    // Viewer reconnects (same ID)
    await counter.join(channelId, viewerId);
    expect(await counter.getCount(channelId)).toBe(1);
    
    // Should not be 2
    expect(await counter.getCount(channelId)).not.toBe(2);
  });
  
  it('should handle concurrent joins atomically', async () => {
    const counter = new ViewerCounter();
    const channelId = 'channel-1';
    
    // 100 concurrent joins
    const joins = Array.from({ length: 100 }, (_, i) =>
      counter.join(channelId, `viewer-${i}`)
    );
    await Promise.all(joins);
    
    expect(await counter.getCount(channelId)).toBe(100);
  });
});
```

## What Changed

1. **Transcode safety** — Playlist generation is verified for all qualities.
2. **Chat reliability** — Message ordering and rate limiting are tested.
3. **Analytics accuracy** — Viewer deduplication and concurrency are verified.
4. **Lifecycle coverage** — Full stream start-to-end flow is tested cross-service.

## Testing as Broadcast Reliability

In streaming, a single bug reaches thousands of viewers in real-time. Tests are the difference between catching a broken HLS playlist in CI and discovering it during a live event with 10,000 viewers.

## Next Pain

Tests run but the codebase still uses CommonJS. Dynamic mocks are inconsistent. You need ESM for cleaner test imports and modern tooling.
