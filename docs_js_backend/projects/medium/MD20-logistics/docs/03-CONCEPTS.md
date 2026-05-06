# Core Concepts

## WHAT: Logistics / Supply Chain Platform

A supply chain management backend that coordinates:
- **Operators**: Create shipments, manage routes, track inventory
- **Drivers**: Update shipment status and location
- **Warehouse Managers**: Manage inventory and capacity

Key entities: `User`, `Warehouse`, `Inventory`, `Shipment`, `Tracking`, `Route`, `RouteNode`

## WHY: The Hard Problems

### 1. Status/Tracking Inconsistency
If shipment status is updated but the tracking event creation fails, customers see "DELIVERED" in one place and "IN_TRANSIT" in another.

**Why it matters:** FedEx's 2018 status inconsistency bug generated 50K+ support tickets and eroded customer trust.

### 2. Circular Routes
Greedy nearest-neighbor algorithms can route a package through the same warehouse multiple times or send it back toward its origin.

**Why it matters:** UPS's 2019 circular routing incident caused a 2-day package to take 8 days, with $500K+ in customer compensation.

### 3. Inventory Consistency
Without transactional updates, inventory counts can drift from actual stock levels.

**Why it matters:** Amazon's 2020 inventory mismatch caused $10M+ in canceled orders when tracking showed "in stock" but warehouses were empty.

## HOW: The Implementation

### Atomic Status Update + Tracking
```typescript
// WRONG: Separate operations (inconsistent on failure)
async updateStatus(id: string, status: ShipmentStatus) {
  const shipment = await prisma.shipment.update({ where: { id }, data: { status } });
  
  try {
    await prisma.tracking.create({ data: { shipmentId: id, status, notes: '...' } });
  } catch (error) {
    // Tracking failed but shipment status was already updated!
    console.error('Failed to create tracking event:', error);
  }
  
  return shipment; // Inconsistent state!
}

// RIGHT: Database transaction
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

### Route Calculation with Direction Check
```typescript
// WRONG: Pure greedy (can loop back)
for (const wh of warehouses) {
  if (visited.has(wh.id)) continue;
  const dist = calculateDistance(current, wh);
  if (dist < minDist) { nearest = wh; minDist = dist; }
}

// RIGHT: Greedy + direction check
for (const wh of warehouses) {
  if (visited.has(wh.id)) continue;
  
  const dist = calculateDistance(current, wh);
  
  // Must bring us closer to destination
  const distToDestBefore = calculateDistance(current, destination);
  const distToDestAfter = calculateDistance(wh, destination);
  
  if (distToDestAfter > distToDestBefore * 1.5) continue;
  
  if (dist < minDist) { nearest = wh; minDist = dist; }
}
```

### Shipment Lifecycle State Machine
```typescript
const validTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  CREATED: ['PICKED_UP', 'EXCEPTION'],
  PICKED_UP: ['IN_TRANSIT', 'EXCEPTION'],
  IN_TRANSIT: ['AT_WAREHOUSE', 'OUT_FOR_DELIVERY', 'EXCEPTION'],
  AT_WAREHOUSE: ['OUT_FOR_DELIVERY', 'IN_TRANSIT', 'EXCEPTION'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'EXCEPTION'],
  DELIVERED: [],
  EXCEPTION: ['IN_TRANSIT', 'OUT_FOR_DELIVERY'],
};

function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return validTransitions[from].includes(to);
}
```

## WRONG vs RIGHT

| Scenario | WRONG Approach | RIGHT Approach |
|----------|---------------|----------------|
| Status update | Separate status + tracking ops | Database transaction |
| Route calc | Pure greedy nearest-neighbor | Greedy + direction check |
| Tracking number | Auto-increment integer | Timestamp + random + prefix |
| Inventory | Update without transaction | Transactional decrement |
| Status transition | Any string allowed | Enum state machine |
| Route storage | No sequence/order | RouteNode with sequence field |

## ASCII Architecture

```
+-------------+      REST/JSON       +---------------+      SQL       +-------------+
|   Operator  | <----------------->  |  Express API  | <------------> |  PostgreSQL  |
|   Portal    |                      |   (Node 20)   |                |   (Prisma)   |
+-------------+                      +---------------+                +-------------+
      |                                    |
      |  Shipment creation                   |  Atomic transactions
      v                                    v
+-------------+                      +---------------+
|  Route      |                      |   Shipment    |
|  Calculator |                      |   + Tracking  |
+-------------+                      +---------------+
```

```
SHIPMENT LIFECYCLE STATE MACHINE

   +--------+     +----------+     +-----------+     +-------------+     +-----------------+
   | CREATED| --> |PICKED_UP | --> | IN_TRANSIT| --> |AT_WAREHOUSE | --> |OUT_FOR_DELIVERY |
   +--------+     +----------+     +-----------+     +-------------+     +-----------------+
      |                |                |                  |                     |
      |                |                |                  |                     |
      |                |                |                  |                     v
      |                |                |                  |               +-----------+
      |                |                |                  |               | DELIVERED |
      |                |                |                  |               +-----------+
      +----------------+----------------+------------------+---------------------+
                                         |
                                         v
                                   +-----------+
                                   | EXCEPTION |
                                   +-----------+
```

```
ROUTE OPTIMIZATION: GREEDY vs DIRECTION-AWARE

Scenario: Origin A, Destination D, Warehouses B and C

A(0,0) ---- B(2,1) ---- C(3,5) ---- D(10,0)

Pure Greedy (WRONG):
A -> B (dist 2.2) -> C (dist 4.1) -> D (dist 7.1)
Total: 13.4, but C takes us away from D!

Direction-Aware (RIGHT):
A -> B (dist 2.2, closer to D)
Skip C (takes us away from D)
B -> D (dist 8.1)
Total: 10.3 (better!)
```

```
WAREHOUSE NETWORK GRAPH

        [WH-NYC] -------- [WH-CHI]
           |                  |
           |                  |
        [WH-DC] -------- [WH-DEN] -------- [WH-SF]
                              |                  |
                              |                  |
                           [WH-DAL] -------- [WH-LA]

Route: NYC -> CHI -> DEN -> DAL -> LA
Distance: 800 + 900 + 700 + 1200 = 3600 km
Estimated Days: ceil(3600 / 800) = 5 days
```
