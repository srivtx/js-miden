# Thinking Process

## Mental Models

Think of a geo-distributed system as a **group of independent post offices** that synchronize mail asynchronously:

```
New York Post Office (us-east)
  ├── Local mailbox: instant delivery
  └── Outbound queue: letters to London, San Francisco (async ship)

London Post Office (eu-west)
  ├── Local mailbox: instant delivery
  └── Outbound queue: letters to New York, San Francisco

San Francisco Post Office (us-west)
  ├── Local mailbox: instant delivery
  └── Outbound queue: letters to New York, London

Conflict: Alice (NY) and Bob (London) both write "balance: $100" and "balance: $200"
  → Both post offices accept the local write immediately
  → When the ships arrive, they discover the conflict
  → Vector clocks tell them: "these two writes happened concurrently"
  → Application must decide: merge, pick one, or keep both
```

## The Hot Path

Local read is the fastest operation:
```
Client (London) ──► eu-west API
  → RoutingService: "You are in eu-west"
  → StorageService.get('user-123')  // Local Redis, ~2ms
  → Return data immediately
```

Local write is almost as fast:
```
Client (London) ──► eu-west API
  → StorageService.update('user-123', { balance: 200 })
  → VectorClock: { 'eu-west': 5 }
  → ReplicationService.replicate()  // Queue for us-east, us-west
  → Return 200 OK to client
  → Async: Replicate to other regions (~100-500ms later)
```

## The Danger Zone

1. **Last-Write-Wins Bug**: `ConflictResolutionService` detects concurrent updates but applies "last-write-wins" using wall-clock timestamps. Clock skew causes data loss.
2. **Replication Loop**: Without deduplication, a record received from us-east is replicated back to us-east, creating an infinite loop.
3. **Split Brain**: Network partition between us-east and eu-west. Both regions accept writes. When the partition heals, conflicts explode.
4. **Causal Violation**: A user reads from eu-west, then writes to us-east. The write has a lower vector clock than the read's version. The system must reject it or merge carefully.

## Question Everything

- **Why not just use a single global database?** Latency. Every write would require cross-continent round-trips (80-150ms). Users would feel the slowness.
- **Why not use strong consistency?** CAP theorem says you can't have consistency, availability, AND partition tolerance. During a network partition, a strongly consistent system must reject writes. We choose to accept writes and resolve conflicts later.
- **Why vector clocks instead of timestamps?** Wall clocks drift (NTP has millisecond-scale jitter). Timestamps can't detect causality. Vector clocks track "happened-before" relationships precisely.
- **What if there are 50 regions?** Vector clocks grow linearly with regions. For 50 regions, each record carries a 50-element map. This is manageable. For 1,000 regions, use dotted version vectors or pruning.

## The "What If" Game

- **What if a region is offline for 24 hours?** It accumulates a backlog of replication messages. When it comes back online, it processes them in order. Conflicts are resolved per-record.
- **What if two regions update the same field in a JSON object?** LWW loses one update. A proper merge strategy (e.g., CRDT map) would preserve both: `{ balance: { 'us-east': 100, 'eu-west': 200 } }`.
- **What if a client reads from eu-west immediately after writing to us-east?** They see stale data (eventual consistency). For read-after-write consistency, the client must pin to one region or use quorum reads.
- **What if the conflict resolution strategy is wrong?** The application must provide a merge function. The system can only detect conflicts; it cannot know that "balance" should be summed while "name" should be LWW.
