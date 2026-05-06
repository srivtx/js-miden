# Decisions & Alternatives

## Decision 1: Text Search Implementation

**Chosen: ILIKE with multiple columns (Phase 1), with explicit warning about performance**

```typescript
if (filters.location) {
  where.OR = [
    { address: { contains: filters.location, mode: 'insensitive' } },
    { city: { contains: filters.location, mode: 'insensitive' } },
    { state: { contains: filters.location, mode: 'insensitive' } },
    { zipCode: { contains: filters.location, mode: 'insensitive' } },
  ];
}
```

**Why:** Works out of the box. No extensions needed.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Trigram index (pg_trgm) | Requires PostgreSQL extension; not available in all managed DBs |
| Full-text search (tsvector) | Best for natural language; overkill for address matching |
| Elasticsearch | Adds infrastructure complexity |
| Algolia | Managed service; ongoing cost |

**Trade-off:** Search will degrade linearly with listing count. Must migrate to indexed search before 100K+ listings.

---

## Decision 2: Geospatial Nearby Search

**Chosen: Bounding box pre-filter + application-level exact distance**

```typescript
const listings = await prisma.listing.findMany({
  where: {
    status: 'ACTIVE',
    latitude: { gte: minLat, lte: maxLat },
    longitude: { gte: minLng, lte: maxLng },
  },
});

const nearby = listings.filter(listing => {
  const distance = haversine(lat, lng, listing.latitude, listing.longitude);
  return distance <= radiusKm;
});
```

**Why:** Bounding box uses B-tree index on lat/lng. Reduces dataset from millions to hundreds.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| PostGIS ST_DWithin | Requires extension; adds ops complexity |
| Geohash indexing | Good but requires geohash library |
| Elasticsearch geo query | Best performance but adds infrastructure |
| Fetch all + filter (current buggy code) | OOM risk; completely unscalable |

**Trade-off:** Still some application-level filtering. PostGIS would be fully index-driven.

---

## Decision 3: Mortgage Calculator

**Chosen: Standard amortization formula**

```typescript
function calculateMortgage(price: number, downPayment: number, rate: number, years: number) {
  const principal = price - downPayment;
  const monthlyRate = rate / 100 / 12;
  const numPayments = years * 12;
  
  const monthlyPayment = 
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const totalInterest = monthlyPayment * numPayments - principal;
  
  return { monthlyPayment, totalInterest, totalCost: price + totalInterest };
}
```

**Why:** Industry-standard formula. Deterministic and testable.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Simple interest | Incorrect for mortgages |
| External mortgage API | Adds dependency; rate limits |
| Monte Carlo simulation | Overkill for fixed-rate mortgages |

**Trade-off:** Only handles fixed-rate mortgages. ARM and interest-only require additional logic.

---

## Decision 4: Tour Booking Conflict Prevention

**Chosen: Unique constraint on (listingId, date, status) or application-level check**

```prisma
// Option: No overlapping bookings via application check
model TourBooking {
  id        String @id @default(uuid())
  listingId String
  userId    String
  date      DateTime
  status    BookingStatus @default(CONFIRMED)
}
```

**Why:** PostgreSQL doesn't natively support exclusion constraints on time ranges without the btree_gist extension.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Exclusion constraint (NO OVERLAP) | Requires btree_gist extension |
| Queue-based booking | Overkill for Phase 1 |
| Optimistic locking | Adds complexity |

**Trade-off:** Application must check for existing bookings before creating new one.

---

## Decision 5: Agent Matching

**Chosen: Haversine distance to nearest available agent**

```typescript
async function findNearestAgent(lat: number, lng: number) {
  const agents = await prisma.agent.findMany();
  
  let nearest = null;
  let minDist = Infinity;
  
  for (const agent of agents) {
    const dist = haversine(lat, lng, agent.latitude, agent.longitude);
    if (dist < minDist) {
      minDist = dist;
      nearest = agent;
    }
  }
  
  return nearest;
}
```

**Why:** Simple and correct for small agent pools.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| k-d tree spatial index | Overkill for <10K agents |
| PostGIS KNN query | Requires extension |
| Elasticsearch geo distance sort | Adds infrastructure |

**Trade-off:** O(n) scan of all agents. Acceptable for <10K agents.
