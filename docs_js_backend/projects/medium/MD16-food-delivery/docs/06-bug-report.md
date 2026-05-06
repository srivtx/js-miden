# Bug Report: Race Condition & Inventory

## Bug 1: Race Condition in Order Assignment

### Severity: HIGH

### Description
Two drivers can simultaneously accept the same order, leading to data inconsistency and potential double-assignment.

### Root Cause
In `OrderService.assignDriver()`, the code checks if an order has a driver, then updates it. Between the check and update, another request can assign a different driver.

```typescript
// Vulnerable code in orderService.ts
async assignDriver(orderId: string, driverId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (order.driverId) {
    throw new Error('Order already assigned');
  }

  // BUG: Race condition window here!
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { driverId, status: OrderStatus.PICKED_UP },
  });
  // ...
}
```

### Impact
- Two drivers arrive at restaurant for same order
- Customer confusion and poor experience
- Driver time wasted
- Potential payment issues

### Reproduction Steps
1. Create an order
2. Have two drivers call `PATCH /api/orders/:id/assign` simultaneously
3. Both requests may succeed

### Fix Options

**Option 1: Atomic Update with Check**
```typescript
const updatedOrder = await prisma.order.updateMany({
  where: { 
    id: orderId, 
    driverId: null // Only update if still unassigned
  },
  data: { driverId },
});

if (updatedOrder.count === 0) {
  throw new Error('Order already assigned');
}
```

**Option 2: Database Transaction**
```typescript
await prisma.$transaction(async (tx) => {
  const order = await tx.order.findUnique({
    where: { id: orderId },
  });
  
  if (order.driverId) throw new Error('Already assigned');
  
  await tx.order.update({
    where: { id: orderId },
    data: { driverId },
  });
});
```

**Option 3: Pessimistic Locking**
```typescript
const order = await prisma.$queryRaw`
  SELECT * FROM orders WHERE id = ${orderId} FOR UPDATE
`;
// Then update...
```

## Bug 2: No Inventory Check

### Severity: MEDIUM

### Description
The system allows customers to order items that are sold out (inventory = 0).

### Root Cause
In `OrderService.createOrder()`, there's no validation of menu item inventory levels.

```typescript
// Vulnerable code
const orderItems = data.items.map((item) => {
  const menuItem = menuItems.find((m) => m.id === item.menuId);
  // BUG: No inventory check!
  total += Number(menuItem.price) * item.quantity;
  return { ... };
});
```

### Impact
- Restaurants receive orders they can't fulfill
- Customer disappointment
- Refund processing required
- Reputation damage

### Fix
```typescript
if (menuItem.inventory < item.quantity) {
  throw new Error(`Item ${menuItem.name} is out of stock`);
}

// Decrement inventory
await prisma.menu.update({
  where: { id: item.menuId },
  data: { inventory: { decrement: item.quantity } },
});
```

### Prevention
- Add database-level CHECK constraint on inventory
- Implement inventory reservation during checkout
- Add inventory sync with restaurant POS systems
