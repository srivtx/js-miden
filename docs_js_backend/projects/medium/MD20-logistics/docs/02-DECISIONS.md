# Decisions & Alternatives

## Decision 1: Status/Tracking Atomicity

**Chosen: Database transaction wrapping both status update and tracking event**

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

**Why:** Guarantees consistency. If tracking creation fails, shipment status is rolled back.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Separate operations with try/catch | Tracking failure leaves inconsistent state |
| Event sourcing (append-only) | Complex replay logic; overkill for Phase 1 |
| Message queue (async) | Eventual consistency; customer sees stale data |

**Trade-off:** Transaction adds ~5-10ms. Acceptable for correctness.

---

## Decision 2: Route Optimization Algorithm

**Chosen: Greedy nearest-neighbor with destination direction check**

```typescript
private calculateRoute(origin, destination, warehouses) {
  const nodes = [];
  let current = origin;
  nodes.push({ warehouseId: origin.id, distanceKm: 0 });
  
  const visited = new Set([origin.id]);
  const maxHops = 5;
  
  for (let i = 0; i < maxHops; i++) {
    let nearest = null;
    let minDist = Infinity;
    
    for (const wh of warehouses) {
      if (visited.has(wh.id)) continue;
      
      const dist = this.calculateDistance(current.latitude, current.longitude, wh.latitude, wh.longitude);
      
      // Direction check: must bring us closer to destination
      const distToDestBefore = this.calculateDistance(
        current.latitude, current.longitude,
        destination.latitude, destination.longitude
      );
      const distToDestAfter = this.calculateDistance(
        wh.latitude, wh.longitude,
        destination.latitude, destination.longitude
      );
      
      if (distToDestAfter > distToDestBefore * 1.5) continue; // Skip if moving away
      
      if (dist < minDist) {
        minDist = dist;
        nearest = wh;
      }
    }
    
    if (!nearest) break;
    
    nodes.push({ warehouseId: nearest.id, distanceKm: minDist });
    visited.add(nearest.id);
    current = nearest;
    
    // Close to destination?
    const distToDest = this.calculateDistance(
      current.latitude, current.longitude,
      destination.latitude, destination.longitude
    );
    if (distToDest < 100) break;
  }
  
  // Add destination
  const finalDist = this.calculateDistance(
    current.latitude, current.longitude,
    destination.latitude, destination.longitude
  );
  nodes.push({ warehouseId: destination.id, distanceKm: finalDist });
  
  return nodes;
}
```

**Why:** Simple to implement. Direction check prevents worst-case circular routes.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Dijkstra's algorithm | Requires pre-computed graph of all warehouse connections |
| A* pathfinding | Requires good heuristic; overkill for Phase 1 |
| Traveling Salesman Problem solver | NP-hard; approximation needed |
| Pre-calculated routes | Requires maintaining route matrix |

**Trade-off:** Not globally optimal. May miss better routes that temporarily go away from destination.

---

## Decision 3: Tracking Number Generation

**Chosen: Timestamp + random + prefix**

```typescript
const trackingNumber = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
```

**Why:** Unique within millisecond precision. Random suffix handles sub-millisecond collisions.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| UUID | Too long for customer-facing tracking numbers |
| Auto-increment integer | Predictable; security risk |
| Snowflake ID | Requires dedicated ID service |
| Database sequence | Single point of contention |

**Trade-off:** Collision probability is extremely low but non-zero. Add unique constraint as safety net.

---

## Decision 4: Inventory Management

**Chosen: Simple quantity tracking per warehouse/SKU**

```prisma
model Inventory {
  id          String @id @default(uuid())
  warehouseId String
  sku         String
  quantity    Int    @default(0)
  updatedAt   DateTime @updatedAt
  
  @@unique([warehouseId, sku])
}
```

**Why:** Simple and correct for Phase 1.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Event sourcing for inventory | Complex replay logic |
| FIFO/LIFO tracking | Requires additional tables |
| Batch/lot tracking | Overkill for Phase 1 |

**Trade-off:** No support for backorders, reservations, or lot tracking.

---

## Decision 5: Shipment Status State Machine

**Chosen: 7 states with valid transitions**

```
CREATED -> PICKED_UP -> IN_TRANSIT -> AT_WAREHOUSE -> OUT_FOR_DELIVERY -> DELIVERED
   |
   +-> EXCEPTION (from any state)
```

**Why:** Explicit state machine prevents invalid transitions.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Free-form status string | Prone to bugs |
| Event sourcing (event log only) | Requires materialized state view |
| Workflow engine (Temporal/Camunda) | Overkill for Phase 1 |

**Trade-off:** Adding new states requires code + migration.
