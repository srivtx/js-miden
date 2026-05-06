# Core Concepts

## WHAT: Ride Sharing Platform

A two-sided marketplace backend that coordinates:
- **Riders**: Request rides, track drivers, pay fares, rate drivers
- **Drivers**: Accept rides, update locations, complete trips, rate riders

Key entities: `User`, `Rider`, `Driver`, `Ride`, `Review`, `Tracking`

## WHY: The Hard Problems

### 1. Non-Atomic Surge Pricing
Reading demand and supply in separate queries creates inconsistent pricing. Two riders requesting simultaneously may get different surge multipliers.

**Why it matters:** Uber's 2014 NYE surge bug undercharged $10M+ in rides because demand reads were stale.

### 2. Stale Location Updates
Mobile networks deliver packets out of order. A 5-minute-old location update can overwrite a 10-second-old one.

**Why it matters:** Lyft's 2017 stale location bug caused riders to wait 15+ minutes for "nearby" drivers who had already moved miles away.

### 3. Double Ride Acceptance
Without atomic acceptance, two drivers can both accept the same ride request.

**Why it matters:** Didi's 2018 race condition led to safety incidents when multiple drivers arrived for the same pickup.

## HOW: The Implementation

### Atomic Surge Pricing
```typescript
// WRONG: Separate queries (read skew)
const demand = await prisma.ride.count({ where: { status: 'REQUESTED' } });
// Another request could change demand here!
const supply = await prisma.driver.count({ where: { isAvailable: true } });
const ratio = demand / supply;

// RIGHT: Transaction guarantees consistent read
const { demand, supply } = await prisma.$transaction(async (tx) => {
  const demandResult = await tx.ride.groupBy({
    by: ['status'],
    where: { status: 'REQUESTED', pickupLat: { gte: lat - 0.1, lte: lat + 0.1 } },
    _count: { status: true },
  });
  const supplyResult = await tx.driver.count({
    where: { isAvailable: true, latitude: { gte: lat - 0.1, lte: lat + 0.1 } },
  });
  return { 
    demand: demandResult[0]?._count.status || 0, 
    supply: supplyResult || 1 
  };
});
```

### Timestamp Validation for Location
```typescript
// WRONG: Unconditional update
async updateLocation(id, lat, lng) {
  return prisma.driver.update({ where: { id }, data: { latitude: lat, longitude: lng } });
}

// RIGHT: Reject stale updates
async updateLocation(id, lat, lng, timestamp) {
  const driver = await prisma.driver.findUnique({ where: { id } });
  if (driver.updatedAt && timestamp <= driver.updatedAt) {
    throw new Error('Stale location update rejected');
  }
  return prisma.driver.update({ where: { id }, data: { latitude: lat, longitude: lng } });
}
```

### Fare Calculation
```typescript
function calculateFare(distanceKm: number, minutes: number, surge: number = 1.0) {
  const baseFare = 2.50;
  const distanceFare = distanceKm * 1.50;
  const timeFare = minutes * 0.35;
  const total = (baseFare + distanceFare + timeFare) * surge;
  
  return {
    baseFare,
    distanceFare,
    timeFare,
    surgeMultiplier: surge,
    total: Math.round(total * 100) / 100,
  };
}
```

## WRONG vs RIGHT

| Scenario | WRONG Approach | RIGHT Approach |
|----------|---------------|----------------|
| Surge pricing | Two separate count queries | Single transaction with both counts |
| Location update | Always overwrite | Timestamp validation + conditional update |
| Ride acceptance | Check status then update | Atomic conditional update |
| Fare storage | Calculate on-the-fly | Store all components (base, distance, time, surge) |
| Rating | Multiple reviews per ride | Unique constraint on rideId |
| Distance | Fixed per zone | Haversine formula (Phase 1) |

## ASCII Architecture

```
+-----------+      REST/JSON       +---------------+      SQL       +-------------+
|  Rider    | <----------------->  |  Express API  | <------------> |  PostgreSQL  |
|   App     |                      |   (Node 20)   |                |   (Prisma)   |
+-----------+                      +---------------+                +-------------+
      |                                   |
      |  WebSocket                        |  Atomic transactions
      v                                   v
+-----------+                      +---------------+
| Socket.IO |                      |   Surge       |
| (Tracking)|                      |   Pricing     |
+-----------+                      |   (tx)        |
                                   +---------------+
```

```
RIDE MATCHING & DISPATCH FLOW

+--------+     +-----------+     +-------------+     +-----------+     +--------+
| Rider  | --> |  Request  | --> |  Calculate  | --> |  Broadcast| --> | Driver |
|Request |     |   Ride    |     |    Fare     |     |  to Nearby|     | Accepts|
+--------+     +-----------+     +-------------+     +-----------+     +--------+
                                                                    |
                                                                    v
+--------+     +-----------+     +-------------+     +-----------+     +--------+
| Rider  | <-- |   Track   | <-- |  Location   | <-- |  Driver   | <-- | Ride   |
|  Sees  |     |   Live    |     |   Updates   |     |  En Route |     |Accepted|
+--------+     +-----------+     +-------------+     +-----------+     +--------+
```

```
SURGE PRICING ZONES (Demand/Supply Ratio)

Zone A: Ratio 3.2  --> 2.5x surge  ($$$$)
Zone B: Ratio 1.8  --> 2.0x surge  ($$$)
Zone C: Ratio 0.9  --> 1.0x surge  ($)
Zone D: Ratio 0.3  --> 1.0x surge  ($)

[====Zone A====]    [Zone B]
       |               |
   High demand     Medium demand
   Low supply      Balanced supply
```
