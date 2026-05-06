# Bug Report: Eventual Consistency & Circular Routes

## Bug 1: No Eventual Consistency

### Severity: HIGH

### Description
When a shipment status is updated or delivery is confirmed, the tracking history may not reflect the same status due to separate, non-atomic operations.

### Root Cause
In `ShipmentService`, status updates and tracking event creation are performed in separate database operations without a transaction.

```typescript
// Vulnerable code in shipmentService.ts
async updateStatus(id: string, status: ShipmentStatus) {
  // Update shipment status
  const shipment = await prisma.shipment.update({
    where: { id },
    data: { status },
  });

  // BUG: Tracking event creation is separate and could fail
  try {
    await prisma.tracking.create({
      data: {
        shipmentId: id,
        status,
        notes: `Status updated to ${status}`,
      },
    });
  } catch (error) {
    // Tracking failed but shipment status was already updated!
    console.error('Failed to create tracking event:', error);
  }

  return shipment;
}
```

### Impact
- Shipment shows "DELIVERED" but tracking shows "IN_TRANSIT"
- Customer confusion
- Support tickets
- Data inconsistency

### Fix

**Use Database Transaction:**
```typescript
async updateStatus(id: string, status: ShipmentStatus) {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.update({
      where: { id },
      data: { status },
    });

    await tx.tracking.create({
      data: {
        shipmentId: id,
        status,
        notes: `Status updated to ${status}`,
      },
    });

    return shipment;
  });
}
```

## Bug 2: Circular Route

### Severity: HIGH

### Description
The routing algorithm can create circular routes where a package is routed through the same warehouse multiple times or sent back toward its origin.

### Root Cause
The greedy nearest-neighbor algorithm in `RouteService.calculateRoute()` doesn't consider the overall direction toward the destination.

```typescript
// Vulnerable code in routeService.ts
private calculateRoute(origin, destination, warehouses) {
  // Greedy nearest neighbor - can loop back
  for (let i = 0; i < maxHops; i++) {
    // Find nearest warehouse
    let nearest = null;
    let minDist = Infinity;

    for (const wh of warehouses) {
      if (visited.has(wh.id)) continue;
      
      const dist = this.calculateDistance(current.latitude, current.longitude, wh.latitude, wh.longitude);

      if (dist < minDist) {
        minDist = dist;
        nearest = wh;
      }
    }

    // BUG: No check if we're moving away from destination
    // Could route through a warehouse that sends us back
    nodes.push({ warehouseId: nearest.id, distanceKm: minDist });
    // ...
  }
}
```

### Impact
- Packages take longer routes than necessary
- Increased shipping costs
- Delayed deliveries
- Customer dissatisfaction

### Fix

**Option 1: A* Algorithm**
Use A* pathfinding with heuristic based on distance to destination.

**Option 2: Simple Direction Check**
```typescript
// Only add warehouse if it brings us closer to destination
const distToDestBefore = this.calculateDistance(
  current.latitude, current.longitude,
  destination.latitude, destination.longitude
);

const distToDestAfter = this.calculateDistance(
  nearest.latitude, nearest.longitude,
  destination.latitude, destination.longitude
);

if (distToDestAfter > distToDestBefore * 1.5) {
  // Skip this warehouse - it takes us too far away
  continue;
}
```

**Option 3: Pre-calculated Routes**
Maintain a graph of warehouse connections with known distances and use Dijkstra's algorithm.
