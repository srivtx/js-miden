# Core Concepts

## WHAT: Food Delivery Platform

A three-sided marketplace backend that coordinates:
- **Customers**: Browse menus, place orders, track deliveries
- **Restaurants**: Manage menus, update order status, receive orders
- **Drivers**: Accept assignments, update locations, complete deliveries

Key entities: `User`, `Restaurant`, `Menu`, `Order`, `OrderItem`, `Driver`, `Tracking`

## WHY: The Hard Problems

### 1. Race Conditions in Driver Assignment
Two drivers can simultaneously check if an order is unassigned, both see `driverId: null`, and both update it. The second update wins silently.

**Why it matters:** DoorDash reported $50M+ in annual driver time waste from double-assignments (2019).

### 2. Inventory Consistency
Without inventory checks, customers order sold-out items. Restaurants must cancel, refund, and disappoint customers.

**Why it matters:** Grubhub's 2018 inventory sync failures caused a 15% refund rate during peak hours.

### 3. Real-Time Tracking at Scale
With 10,000+ concurrent deliveries, broadcasting location updates to the right customers without overwhelming the server is non-trivial.

**Why it matters:** Deliveroo's Frank algorithm handles 50M+ location updates daily across 12 countries.

## HOW: The Implementation

### Atomic Driver Assignment
```typescript
// WRONG: Check-then-update (race condition window)
const order = await prisma.order.findUnique({ where: { id } });
if (order.driverId) throw new Error('Already assigned');
await prisma.order.update({ where: { id }, data: { driverId } }); // Race!

// RIGHT: Atomic conditional update
const result = await prisma.order.updateMany({
  where: { id, driverId: null }, // Only if still unassigned
  data: { driverId, status: 'PICKED_UP' },
});
if (result.count === 0) throw new Error('Already assigned');
```

### Inventory Validation
```typescript
// WRONG: No inventory check
const menuItem = await prisma.menu.findUnique({ where: { id } });
total += Number(menuItem.price) * quantity; // Could be sold out!

// RIGHT: Validate + decrement atomically
if (menuItem.inventory < quantity) {
  throw new Error(`Out of stock: ${menuItem.name}`);
}
await prisma.menu.update({
  where: { id },
  data: { inventory: { decrement: quantity } },
});
```

### ETA Calculation
```typescript
// Haversine formula (great-circle distance)
const R = 6371; // Earth's radius in km
const dLat = toRad(driverLat - destLat);
const dLon = toRad(driverLng - destLng);
const a = Math.sin(dLat/2)**2 + 
          Math.cos(toRad(driverLat)) * Math.cos(toRad(destLat)) * 
          Math.sin(dLon/2)**2;
const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
const etaMinutes = Math.ceil((distanceKm / 30) * 60); // 30 km/h urban
```

### State Machine for Order Status
```typescript
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return validTransitions[from].includes(to);
}
```

## WRONG vs RIGHT

| Scenario | WRONG Approach | RIGHT Approach |
|----------|---------------|----------------|
| Driver assignment | `findUnique` then `update` | `updateMany` with null check |
| Inventory | No validation | Check + atomic decrement |
| ETA | Fixed 30 min for all orders | Haversine + speed estimate |
| Tracking | Poll every 10s | Socket.IO push |
| Status update | Any string allowed | Enum state machine |
| Menu pricing | Float (`number`) | `Decimal(10,2)` |

## ASCII Architecture

```
+-------------+      REST/JSON      +---------------+      SQL       +-------------+
|   Mobile    | <-----------------> |  Express API  | <------------> |  PostgreSQL  |
|   Client    |                     |   (Node 20)   |                |   (Prisma)   |
+-------------+                     +---------------+                +-------------+
       |                                    |
       |  WebSocket                         |  Atomic transactions
       v                                    v
+-------------+                     +---------------+
|  Socket.IO  |                     |   Order       |
|  (Tracking) |                     |   Assignment  |
+-------------+                     |   (updateMany)|
                                    +---------------+
```

```
ORDER LIFECYCLE STATE MACHINE

   +---------+     +-----------+     +-------+     +-----------+     +-----------+
   | PLACED  | --> | PREPARING | --> | READY | --> | PICKED_UP | --> | DELIVERED |
   +---------+     +-----------+     +-------+     +-----------+     +-----------+
        |                |               |               |                  |
        |                |               |               |                  |
        +----------------+---------------+---------------+------------------+
                                         |
                                         v
                                   +-----------+
                                   | CANCELLED |
                                   +-----------+
```
