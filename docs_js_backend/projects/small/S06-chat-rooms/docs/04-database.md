# S06 Chat Rooms — Database

## Current State: No Persistent Database

This project stores room memberships purely in memory:
```typescript
const rooms = new Map<string, Set<string>>();
```

Messages are not persisted; if the server restarts, all history is lost.

## Decision: In-Memory vs. Persistent Message Store

### Alternative 1: In-Memory Only
- **Pros**: Zero latency, no serialization cost, no operational dependencies.
- **Cons**: No durability, no horizontal scaling, memory bounded by RAM.
- **Verdict**: Suitable for ephemeral demo apps or ephemeral signaling (e.g., WebRTC handshake).

### Alternative 2: Relational Database (PostgreSQL)
- **Pros**: ACID compliance, rich querying, proven durability.
- **Cons**: Write latency (~1–5 ms) is too slow for high-frequency chat; table bloat with billions of messages; hard to shard.
- **Verdict**: Good for small team chat or when strong consistency matters; often paired with Redis for real-time fan-out.

### Alternative 3: Time-Series / Wide-Column Store (Cassandra, ScyllaDB)
- **Pros**: Write-optimized for append-only message streams, easy to shard by room_id + timestamp, massive scale (Discord uses ScyllaDB).
- **Cons**: Eventual consistency, complex operations (deleting a message requires a tombstone), operational expertise required.
- **Verdict**: The architecture of choice for massive-scale chat (Discord, WhatsApp).

## Recommended Schema (If Persistence Were Added)

```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id),
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_room_time ON messages(room_id, created_at DESC);
```

**Rationale**: The composite index on `(room_id, created_at DESC)` makes "last 50 messages in room" queries efficient.

## Presence Data Model

For production presence (who is online), a relational table is poor because it requires constant updates. Instead:
- **Redis**: `SADD room:engineering user_id` with `EXPIRE` heartbeat.
- **Cassandra**: Lightweight transactions or TTL columns.
- **Heartbeat pattern**: Client sends `ping` every 30s; server refreshes TTL. If TTL expires, user is considered offline.
