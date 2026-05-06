# Concepts Explained

## Concept: CAP Theorem

### WHAT Is It?
In a distributed data store, you can only guarantee two of three properties simultaneously:
- **Consistency (C)**: Every read sees the latest write
- **Availability (A)**: Every request receives a response (without guarantee it contains the latest write)
- **Partition Tolerance (P)**: The system continues to operate despite network failures

### WHY Does It Matter?
Network partitions are inevitable (undersea cables, ISP outages, datacenter failures). A distributed system MUST choose between consistency and availability during a partition.

### HOW Does It Apply?
```
Network Partition:
┌─────────┐     XXXXXXX     ┌─────────┐
│ us-east │  ◄──broken──►  │ eu-west │
└────┬────┘                 └────┬────┘
     │                           │
  Write accepted              Write accepted
  (Availability)              (Availability)

When partition heals:
  ┌─────────┐ ◄──────────► ┌─────────┐
  │ us-east │   replicate   │ eu-west │
  └─────────┘               └─────────┘
  Same record, two versions → CONFLICT!
```

### WRONG vs RIGHT

**WRONG** — Claiming you can have all three:
> "Our system is consistent, available, and partition-tolerant."
This is mathematically impossible. If you claim all three, you don't understand the theorem.

**RIGHT** — Explicitly choosing your trade-off:
> "Our system is AP. We prioritize availability during partitions and resolve conflicts asynchronously."

---

## Concept: Vector Clocks

### WHAT Are They?
Vector clocks track causality in distributed systems by maintaining a mapping of `{ node: logical_timestamp }` for each record.

### WHY Do We Need Them?
Wall clocks drift. You cannot use `Date.now()` to determine if two events are concurrent. Vector clocks provide a logical ordering that is independent of physical time.

### HOW Do They Work?
```
Initial state: user-123 = { balance: 0, v: {} }

us-east writes: { balance: 100, v: { 'us-east': 1 } }
  (us-east increments its own clock)

us-east writes again: { balance: 150, v: { 'us-east': 2 } }
  (us-east increments to 2)

us-west writes (concurrent): { balance: 200, v: { 'us-west': 1 } }
  (us-west never saw us-east's write, so its clock is independent)

Replication:
  us-east receives us-west's update:
    Compare v: { 'us-east': 2 } vs { 'us-west': 1 }
    us-east has a value us-west doesn't (2 > undefined)
    us-west has a value us-east doesn't (1 > undefined)
    → CONCURRENT! Neither happened-before the other.
```

Comparison rules:
- **VC1 ≤ VC2**: All regions in VC1 ≤ corresponding regions in VC2
- **VC1 < VC2**: VC1 ≤ VC2 AND VC1 ≠ VC2 (VC2 is strictly newer)
- **VC1 || VC2**: Neither VC1 ≤ VC2 nor VC2 ≤ VC1 (concurrent / conflict)

### WRONG vs RIGHT

**WRONG** — Using timestamps for conflict detection:
```typescript
const winner = remote.timestamp > local.timestamp ? remote : local;
```
If us-east's clock is 500ms ahead of us-west's clock, us-east will ALWAYS win, even if us-west's write was causally later.

**RIGHT** — Using vector clocks:
```typescript
const comparison = compareVectorClocks(local.vectorClock, remote.vectorClock);
if (comparison === 'concurrent') {
  // Real conflict! Apply merge strategy.
}
```

---

## Concept: Replication

### WHAT Is It?
Copying data from one region to another so that all regions eventually have the same state.

### WHY Do We Need It?
Users in different regions need to see the same data. If Alice updates her profile in New York, Bob in London should see it eventually.

### HOW Does It Work?
```
Write Flow:
  Client → us-east API
    → StorageService.update()        (local write, ~2ms)
    → VectorClock incremented
    → ReplicationService.replicate()  (queue for us-west, eu-west)
    → Return 200 OK to client
    → Async: Send to peers            (~100-500ms)

Read Flow:
  Client → GeoDNS → eu-west API
    → StorageService.get()           (local read, ~2ms)
    → Return data (may be stale)
```

### WRONG vs RIGHT

**WRONG** — Synchronous replication:
```typescript
// Wait for all regions to acknowledge
for (const peer of peers) {
  await fetch(`http://${peer}/replicate`, { method: 'POST', body: record });
}
res.json({ success: true });
```
If eu-west is slow, every write is slow. If eu-west is partitioned, writes fail entirely.

**RIGHT** — Asynchronous replication:
```typescript
// Acknowledge locally, replicate async
storage.update(record);
replication.queue(record); // Background worker sends to peers
res.json({ success: true });
```

---

## Concept: Conflict Resolution Strategies

### WHAT Are They?
Methods for merging or selecting between concurrent versions of the same record.

### WHY Do They Matter?
In AP systems, conflicts are inevitable. The strategy determines whether data is lost, preserved, or merged.

### HOW Do They Work?

| Strategy | Behavior | Pros | Cons |
|----------|----------|------|------|
| Last-Write-Wins (LWW) | Pick the highest timestamp | Simple, deterministic | Clock skew causes data loss |
| Multi-Value Register | Keep all concurrent versions | No data loss | Client must resolve; storage grows |
| CRDTs | Merge automatically using math | Always correct | Limited data types |
| Application Merge | Custom logic per data type | Semantically correct | Requires domain expertise |

### WRONG vs RIGHT

**WRONG** — Using LWW for a shopping cart:
```
us-east: Add item A (cart: [A])
us-west: Add item B (cart: [B])
LWW winner: [B]  // Item A is lost!
```

**RIGHT** — Using a set-based merge:
```
us-east: Add item A (cart: [A])
us-west: Add item B (cart: [B])
Merged cart: [A, B]  // Both items preserved
```
For a bank balance, you might need application-level logic: "requires manual review if concurrent updates differ by > $10,000."

---

## Concept: Geo-Routing

### WHAT Is It?
Directing users to the nearest or lowest-latency datacenter.

### WHY Do We Need It?
The speed of light limits round-trip time. New York to London is ~70ms minimum (fiber). New York to San Francisco is ~40ms. Routing users to the wrong coast adds unnecessary latency.

### HOW Does It Work?
```
DNS-Based:
  api.example.com → Route 53 latency records
    ├── User in NY → resolves to us-east IP
    ├── User in SF → resolves to us-west IP
    └── User in London → resolves to eu-west IP

Application-Based:
  Client measures RTT to each region
  Pins to lowest-latency region for session duration
```

### WRONG vs RIGHT

**WRONG** — Routing based on geolocation IP databases alone:
```typescript
const region = geoip.lookup(clientIP).region; // 'US-CA'
```
VPNs, corporate proxies, and CDNs make IP geolocation inaccurate. A user in Tokyo using a VPN in New York would be routed to us-east.

**RIGHT** — Latency-based measurement:
```typescript
// Client pings each region
const latencies = await Promise.all([
  ping('us-east.example.com'),
  ping('us-west.example.com'),
  ping('eu-west.example.com'),
]);
const best = latencies.sort((a, b) => a.rtt - b.rtt)[0];
```
