# Decisions & Alternatives

## Decision 1: Surge Pricing Consistency

**Chosen: Database transaction for demand+supply read**

```typescript
const { demand, supply } = await prisma.$transaction(async (tx) => {
  const demandResult = await tx.ride.groupBy({...});
  const supplyResult = await tx.driver.count({...});
  return { demand: demandResult[0]?._count.status || 0, supply: supplyResult || 1 };
});
```

**Why:** Guarantees consistent read within transaction isolation level. No extra infrastructure.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Redis INCR/DECR counters | Counter drift if app crashes between Redis write and DB write |
| Application-level cache | Stale data; cache invalidation complexity |
| Event-driven counters (Kafka) | Overkill for Phase 1; adds significant latency |
| Materialized view | Fast but data is stale between refreshes |

**Trade-off:** Transaction adds ~5-10ms overhead. Acceptable for fare calculation.

---

## Decision 2: Driver Location Timestamp Validation

**Chosen: Reject updates with timestamps older than current `updatedAt`**

```typescript
async updateLocation(id, latitude, longitude, timestamp) {
  const driver = await prisma.driver.findUnique({ where: { id } });
  if (driver.updatedAt && timestamp <= driver.updatedAt) {
    throw new Error('Stale location update rejected');
  }
  return prisma.driver.update({ where: { id }, data: { latitude, longitude } });
}
```

**Why:** Prevents out-of-order network updates from corrupting driver location.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Ignore and always overwrite | Stale data causes rider confusion |
| TTL on location (expire after 60s) | Doesn't solve ordering; just limits staleness |
| Vector clock / Lamport timestamps | Overkill for single-node time validation |

**Trade-off:** Requires client to send reliable timestamps (use NTP-synced device time).

---

## Decision 3: Dispatch Algorithm

**Chosen: Pull-based (driver accepts nearest request)**

**Why:** Simple to implement; no push infrastructure needed.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Push-based broadcast (nearest driver gets offer) | Requires FCM/APNS push notifications |
| Batch optimization (Uber-style) | Complex linear programming solver |
| Predictive dispatch (position drivers before request) | Requires ML model + historical data |

**Trade-off:** Pull-based has higher latency (driver must actively check app).

---

## Decision 4: Fare Calculation Formula

**Chosen: Linear formula with surge multiplier**

```
Total Fare = (Base Fare + Distance Fare + Time Fare) * Surge Multiplier
Base Fare = $2.50
Distance Fare = $1.50 per km
Time Fare = $0.35 per minute
Surge = f(demand/supply ratio)
```

**Why:** Transparent, easy to debug, deterministic.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| ML-based dynamic pricing | Black box; hard to explain to regulators |
| Auction-based pricing | Complex; rider friction |
| Flat rate per zone | Doesn't account for distance/time variation |

**Trade-off:** Linear formula doesn't optimize for driver supply elasticity.

---

## Decision 5: Rating System Design

**Chosen: One review per ride, linked to ride record**

```prisma
model Review {
  id         String @id @default(uuid())
  rideId     String @unique // One review per ride
  reviewerId String
  rating     Int    // 1-5
  comment    String?
}
```

**Why:** Prevents duplicate reviews and provides audit trail.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Separate rider/driver review tables | More complex; no ride linkage |
| Anonymous reviews | No accountability for fake reviews |
| Review moderation queue | Adds latency; overkill for Phase 1 |

**Trade-off:** No review editing after submission.
