# Presence Awareness

## What Is Presence?
Presence shows **who is currently in the room** and what they are doing:
- User names and avatars
- Cursor positions
- Current selection (e.g., "Alice is editing the title")
- Activity status (idle, active, away)

## Why Presence Is Hard
- **High frequency**: Cursor moves generate 30–60 messages per second per user
- **Scale**: 100 users × 60 fps = 6,000 messages/sec per room
- **Ephemerality**: Presence data is meaningless after a user disconnects

## Architecture: Ephemeral vs Persistent

```
Ephemeral Presence (Redis)
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client A  │◄────►│   Server     │◄────►│   Redis     │
│             │      │              │      │  (Pub/Sub   │
└─────────────┘      └──────────────┘      │   + TTL)    │
                                           └─────────────┘

Persistent State (Postgres)
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client A  │◄────►│   Server     │◄────►│ PostgreSQL  │
│             │      │              │      │  (room ops,  │
└─────────────┘      └──────────────┘      │   snapshots) │
                                           └─────────────┘
```

- **Cursor positions** → Redis with TTL (e.g., 5 seconds)
- **Document operations** → PostgreSQL (permanent)

## Throttling Cursor Updates

Sending every cursor move to all users wastes bandwidth. **Throttle** at the client and the server.

```typescript
// Client-side throttle: send at most every 50ms
const throttle = (fn: Function, delay: number) => {
  let last = 0;
  return (...args: any[]) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    }
  };
};

const sendCursor = throttle((x: number, y: number) => {
  ws.send(JSON.stringify({ type: 'cursor', x, y }));
}, 50);
```

```typescript
// Server-side: only broadcast if position changed significantly
class PresenceManager {
  private lastCursors = new Map<string, { x: number; y: number }>();

  updateCursor(userId: string, x: number, y: number): boolean {
    const last = this.lastCursors.get(userId);
    if (last && Math.abs(last.x - x) < 5 && Math.abs(last.y - y) < 5) {
      return false; // skip
    }
    this.lastCursors.set(userId, { x, y });
    return true;
  }
}
```

## Presence Message Format

```typescript
interface PresenceUpdate {
  type: 'presence';
  roomId: string;
  users: Array<{
    userId: string;
    name: string;
    color: string;
    cursor?: { x: number; y: number };
    selection?: { objectId: string };
    status: 'active' | 'idle';
    lastSeen: number; // timestamp
  }>;
}
```

## Handling Disconnections

When a client disconnects, presence must be cleaned up quickly.

```typescript
ws.on('close', () => {
  room.removeClient(userId);
  redis.del(`presence:${roomId}:${userId}`);
  room.broadcastPresence();
});

// TTL fallback: if server crashes, Redis expires stale presence
redis.setex(`presence:${roomId}:${userId}`, 10, JSON.stringify(presence));
```

## Sequence Diagram: Presence Flow

```
Alice                          Server                          Bob
  │                              │                              │
  │── join room ────────────────▶│                              │
  │                              │── broadcast presence ──────▶│
  │                              │     (Alice joined)           │
  │                              │                              │
  │── cursor move ──────────────▶│                              │
  │                              │── broadcast cursor ────────▶│
  │                              │     (Alice @ 120, 340)       │
  │                              │                              │
  │── idle (no input 30s) ──────▶│                              │
  │                              │── broadcast status ────────▶│
  │                              │     (Alice is idle)          │
  │                              │                              │
  │── disconnect ───────────────▶│                              │
  │                              │── broadcast presence ──────▶│
  │                              │     (Alice left)             │
```

## Design Decisions

| Decision | Option A | Option B | Recommendation |
|---|---|---|---|
| Cursor frequency | 60 fps (real-time) | 20 fps (throttled) | **20 fps** with client-side interpolation |
| Storage | Redis TTL | In-memory only | **Redis TTL** for multi-server resilience |
| Idle timeout | 30 seconds | 5 minutes | **30 seconds** for accuracy |
| Reconnection | Replay all presence | Sync current snapshot | **Sync snapshot** on rejoin |

## References

- "How Figma's Multiplayer Technology Works" — Evan Wallace, Figma Engineering Blog
- "Designing Presence in Distributed Systems" — Martin Kleppmann
