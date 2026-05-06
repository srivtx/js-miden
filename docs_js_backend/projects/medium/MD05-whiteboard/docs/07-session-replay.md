# Session Replay

## What Is Session Replay?
Session replay reconstructs the whiteboard state at **any point in time** by replaying the operation log from the beginning (or a snapshot).

## Why It Matters
- **Debugging**: Reproduce a bug reported by a user
- **Compliance**: Audit what happened in a meeting
- **User experience**: "Watch" a past brainstorming session
- **Recovery**: Revert to a previous state

## Operation Log Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OPERATION LOG                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Snapshot 0 (t=0)                                           │
│  ┌─────────────────┐                                        │
│  │ Initial state   │                                        │
│  │ (empty canvas)  │                                        │
│  └─────────────────┘                                        │
│                                                              │
│  Op 1  (t=100ms)  insert text "Brainstorm" at (100, 100)   │
│  Op 2  (t=350ms)  insert rectangle at (200, 200)            │
│  Op 3  (t=900ms)  move text "Brainstorm" to (150, 100)      │
│  Op 4  (t=1200ms) delete rectangle                          │
│  ...                                                        │
│                                                              │
│  Snapshot N (t=60s)  ──  periodic checkpoints               │
│  ┌─────────────────┐                                        │
│  │ State at 60s    │                                        │
│  │ (compressed)    │                                        │
│  └─────────────────┘                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Snapshotting Strategy

Replaying from operation 0 for a 2-hour session is slow. Take **periodic snapshots**:

```typescript
const SNAPSHOT_INTERVAL_MS = 60000; // every 60 seconds

class Room {
  async saveSnapshot() {
    const snapshot = this.state.serialize();
    await db.snapshot.create({
      data: {
        roomId: this.id,
        opCount: this.ops.length,
        state: snapshot,
        createdAt: new Date(),
      },
    });
  }
}

// Cron job or timer
setInterval(() => room.saveSnapshot(), SNAPSHOT_INTERVAL_MS);
```

## Replay Algorithm

```typescript
async function replayToTimestamp(roomId: string, targetTime: Date): Promise<State> {
  // 1. Find the latest snapshot before targetTime
  const snapshot = await db.snapshot.findFirst({
    where: { roomId, createdAt: { lte: targetTime } },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Load state from snapshot (or empty if none)
  const state = snapshot
    ? State.deserialize(snapshot.state)
    : new State();

  // 3. Find all ops after the snapshot up to targetTime
  const ops = await db.operation.findMany({
    where: {
      roomId,
      createdAt: { gt: snapshot?.createdAt ?? new Date(0), lte: targetTime },
    },
    orderBy: { createdAt: 'asc' },
  });

  // 4. Apply ops sequentially
  for (const op of ops) {
    state.apply(op);
  }

  return state;
}
```

## Optimized Replay: Binary Search on Snapshots

For very long sessions, store snapshots at geometric intervals:

```
Every 1s for first 60s
Every 10s for next 10 minutes
Every 60s for next hour
Every 5min after that
```

## Replay for Video Export

To export a session as a video:
1. Replay at 30 frames per second
2. Render each frame to an image
3. Encode images to MP4 with ffmpeg

```typescript
async function exportVideo(roomId: string, fps = 30): Promise<string> {
  const startTime = await getSessionStart(roomId);
  const endTime = await getSessionEnd(roomId);
  const durationMs = endTime.getTime() - startTime.getTime();
  const totalFrames = Math.ceil(durationMs / 1000 * fps);

  for (let i = 0; i < totalFrames; i++) {
    const t = new Date(startTime.getTime() + (i / fps) * 1000);
    const state = await replayToTimestamp(roomId, t);
    await renderFrame(state, `frame_${i.toString().padStart(6, '0')}.png`);
  }

  await exec(`ffmpeg -framerate ${fps} -i frame_%06d.png output.mp4`);
  return 'output.mp4';
}
```

## Storage Cost

| Data Type | Size | Optimization |
|---|---|---|
| Operation log | ~100 bytes/op | Compress with gzip |
| Snapshots | ~10 KB each | Binary format (protobuf, msgpack) |
| Total for 1-hour session | ~1 MB | Aggressive snapshot pruning |

## OWASP Considerations

- **Authorization**: Only room members can replay sessions
- **Data retention**: Auto-delete logs after compliance period (e.g., GDPR: 30 days)
- **Sanitization**: Ensure replayed operations cannot execute arbitrary code (XSS)

## References

- "Time-Travel Debugging in Distributed Systems" — Jay Kreps, Confluent Blog
- "Event Sourcing Pattern" — Martin Fowler
