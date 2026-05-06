# Old Ways vs New Ways (2015 vs 2025)

## Pattern 1: Global Data Architecture

### The Old Way (2010-2015)
Single-region master with read replicas:
```
┌─────────────┐         ┌─────────────┐
│  Master DB  │◄────────│ Read Replica │
│  (us-east)  │  sync   │  (us-west)   │
└─────────────┘         └─────────────┘
```
**Why we did it:** Simple. Strong consistency. One source of truth.
**Why it's wrong now:** All writes go to one region. A user in London writes to us-east (80ms RTT). During peak load, the master becomes a bottleneck. If the master fails, failover takes minutes.

### The New Way (2025)
Active-active geo-distributed with eventual consistency:
```
┌─────────┐  ◄────async replicate────►  ┌─────────┐
│ us-east │                              │ eu-west │
│  (R/W)  │  ◄────async replicate────►  │  (R/W)  │
└─────────┘                              └─────────┘
```
**Why it's better:** Users read and write locally. No single point of failure. Regions operate independently during partitions.

### Migration Path
1. Add vector clock metadata to all records.
2. Deploy API instances in new regions with local storage.
3. Add asynchronous replication between regions.
4. Implement conflict detection and resolution.
5. Switch from master-slave to active-active routing.

---

## Pattern 2: Conflict Resolution

### The Old Way
Last-write-wins with timestamps:
```sql
UPDATE records SET value = 'new', updated_at = NOW()
WHERE id = 1 AND updated_at < '2024-01-01 12:00:00';
```
**Why it's wrong:** Clock skew causes silent data loss. `NOW()` on server A is 500ms ahead of server B. Server B's write is always discarded, even if it was causally later.

### The New Way
Vector clocks with application merge:
```typescript
const comparison = compareVectorClocks(local.v, remote.v);
if (comparison === 'concurrent') {
  const merged = mergeValues(local.value, remote.value);
  return { winner: merged, strategy: 'merge' };
}
```
**Why it's better:** Detects true concurrency, not just time ordering. Preserves both updates when possible.

---

## Pattern 3: Routing

### The Old Way
Static DNS A records:
```
api.example.com → 203.0.113.1 (us-east only)
```
**Why it's wrong:** All global traffic hits one datacenter. Users in Asia suffer 200ms+ latency.

### The New Way
Latency-based GeoDNS + application stickiness:
```
api.example.com (Route 53 latency records)
  ├── User in NY → 203.0.113.1 (us-east)
  ├── User in SF → 203.0.113.2 (us-west)
  └── User in London → 198.51.100.1 (eu-west)
```
**Why it's better:** Automatic routing to nearest region. Health-check failover. Session stickiness prevents consistency anomalies.

---

## Pattern 4: Consistency Guarantees

### The Old Way
Strong consistency everywhere:
```
Every write requires acknowledgement from majority of replicas.
```
**Why it's wrong:** High latency. Unavailable during partitions. Overkill for shopping carts and user preferences.

### The New Way
Choose consistency per operation:
```typescript
// Shopping cart: eventual consistency (AP)
cartService.update(userId, item); // Local ack, async replicate

// Bank transfer: strong consistency (CP)
ledgerService.transfer(from, to, amount); // Quorum write, synchronous
```
**Why it's better:** Right tool for the right job. Not all data needs the same guarantees.

---

## Pattern 5: Failure Handling

### The Old Way
"The database is down. Site is offline."
```
Master DB failure → All writes fail → 500 errors for everyone
```
**Why it's wrong:** A single component failure becomes a total outage.

### The New Way
Graceful degradation:
```
us-east partitioned from eu-west:
  → us-east continues serving local traffic
  → eu-west continues serving local traffic
  → Replication backlog accumulates
  → When partition heals, backlog is processed, conflicts resolved
```
**Why it's better:** Users experience degraded service (stale data) rather than no service.
