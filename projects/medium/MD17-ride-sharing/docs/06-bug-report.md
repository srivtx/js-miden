# Bug Report: Surge Pricing & Stale Location

## Bug 1: Surge Pricing Not Atomic

### Severity: HIGH

### Description
The surge pricing calculation reads demand and supply in separate, non-atomic queries. Between reading demand and reading supply, the values can change, resulting in incorrect surge multipliers.

### Root Cause
In `RideService.getSurgeMultiplier()`, the code performs two separate database queries:
1. Count rides with status REQUESTED (demand)
2. Count available drivers (supply)

Between these queries, other requests can change the demand or supply.

```typescript
// Vulnerable code in rideService.ts
private async getSurgeMultiplier(lat: number, lng: number): Promise<number> {
  // Query 1: Read demand
  const demandResult = await prisma.ride.groupBy({...});
  const demand = demandResult[0]?._count.status || 0;

  // BUG: Demand may have changed here!

  // Query 2: Read supply
  const supplyResult = await prisma.driver.count({...});
  const supply = supplyResult || 1;

  // Calculate ratio with potentially stale data
  const ratio = demand / supply;
  // ...
}
```

### Impact
- Inconsistent pricing for simultaneous ride requests
- Riders charged incorrect fares
- Revenue loss or customer complaints
- Unfair pricing during peak hours

### Reproduction Steps
1. Have multiple riders request rides simultaneously in the same zone
2. Each ride request calculates its own surge multiplier
3. Compare multipliers - they may differ incorrectly

### Fix Options

**Option 1: Database Transaction**
```typescript
const { demand, supply } = await prisma.$transaction(async (tx) => {
  const demandResult = await tx.ride.groupBy({...});
  const supplyResult = await tx.driver.count({...});
  return {
    demand: demandResult[0]?._count.status || 0,
    supply: supplyResult || 1
  };
});
```

**Option 2: Materialized View**
Create a materialized view that aggregates demand/supply per zone, refreshed periodically.

**Option 3: Redis Counter**
Use Redis INCR/DECR for atomic demand/supply counters per zone.

## Bug 2: Driver Location Stale Updates

### Severity: MEDIUM

### Description
The system accepts driver location updates without timestamp validation, allowing stale or out-of-order location updates to overwrite newer data.

### Root Cause
In `DriverService.updateLocation()`, location updates are applied unconditionally.

```typescript
// Vulnerable code in driverService.ts
async updateLocation(id: string, latitude: number, longitude: number) {
  // BUG: No timestamp validation
  return prisma.driver.update({
    where: { id },
    data: { latitude, longitude },
  });
}
```

### Impact
- Rider sees driver at wrong location
- ETA calculations incorrect
- Driver appears far away when actually close
- Poor user experience

### Fix
```typescript
async updateLocation(id: string, latitude: number, longitude: number, timestamp: Date) {
  const driver = await prisma.driver.findUnique({ where: { id } });
  
  // Only update if the new timestamp is newer
  if (driver.updatedAt && timestamp <= driver.updatedAt) {
    throw new Error('Stale location update rejected');
  }
  
  return prisma.driver.update({
    where: { id },
    data: { latitude, longitude },
  });
}
```

### Prevention
- Include client timestamp in location updates
- Implement TTL for location data
- Use WebSocket acknowledgments
- Add location update rate limiting
