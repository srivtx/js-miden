# Old vs New: Food Delivery Tech (2015 vs 2025)

## Architecture Patterns

| Aspect | 2015 Approach | 2025 Approach |
|--------|---------------|---------------|
| **API Framework** | Express 4 with callbacks | Express 5 with async/await + ESM |
| **Database** | Raw SQL / Mongoose | Prisma ORM with type safety |
| **Real-time** | Long polling | Socket.IO with Redis adapter |
| **Driver Assignment** | Single-threaded queue | Batch optimization (Deliveroo Frank) |
| **ETA** | Google Maps API calls | ML models (Uber Michelangelo) |
| **Inventory** | Daily batch sync | Real-time event streaming |

## Code Comparison

### Driver Assignment (2015 vs 2025)

**2015 (Callback Hell):**
```javascript
// Express 4, callbacks, no type safety
app.patch('/orders/:id/assign', function(req, res) {
  db.query('SELECT * FROM orders WHERE id = ?', [req.params.id], function(err, rows) {
    if (err) return res.status(500).send(err);
    if (rows[0].driver_id) return res.status(400).send('Already assigned');
    
    db.query('UPDATE orders SET driver_id = ? WHERE id = ?', 
      [req.body.driverId, req.params.id], function(err2) {
      if (err2) return res.status(500).send(err2);
      res.json({ success: true });
    });
  });
});
```

**2025 (TypeScript + Prisma):**
```typescript
// Express 5, async/await, type-safe, atomic
app.patch('/orders/:id/assign', async (req, res) => {
  const result = await prisma.order.updateMany({
    where: { id: req.params.id, driverId: null },
    data: { driverId: req.body.driverId, status: 'PICKED_UP' },
  });
  
  if (result.count === 0) {
    return res.status(409).json({ error: 'Already assigned' });
  }
  
  res.json({ success: true });
});
```

### Inventory Check (2015 vs 2025)

**2015:**
```javascript
// No inventory check at all
function createOrder(items) {
  let total = 0;
  items.forEach(item => {
    total += item.price * item.quantity; // Could be sold out!
  });
  db.query('INSERT INTO orders ...', [total]);
}
```

**2025:**
```typescript
// Atomic inventory validation + decrement
async function createOrder(items) {
  const menuItems = await prisma.menu.findMany({
    where: { id: { in: items.map(i => i.menuId) } },
  });
  
  for (const item of items) {
    const menuItem = menuItems.find(m => m.id === item.menuId);
    if (menuItem.inventory < item.quantity) {
      throw new Error(`Out of stock: ${menuItem.name}`);
    }
  }
  
  // Decrement inventory in transaction
  await prisma.$transaction(items.map(item =>
    prisma.menu.update({
      where: { id: item.menuId },
      data: { inventory: { decrement: item.quantity } },
    })
  ));
}
```

### ETA Calculation (2015 vs 2025)

**2015:**
```javascript
// Fixed ETA or basic distance
function getEta() {
  return 30; // Always 30 minutes
}
```

**2025:**
```typescript
// ML-enhanced ETA with confidence intervals
function getEta(driverLat, driverLng, destLat, destLng, 
                 historicalData, trafficData, weatherData) {
  const baseEta = haversineDistance(driverLat, driverLng, destLat, destLng) / 30 * 60;
  const trafficFactor = trafficData.congestionLevel;
  const historicalFactor = historicalData.avgDelayForRoute;
  const weatherFactor = weatherData.impactMultiplier;
  
  return {
    estimated: Math.round(baseEta * trafficFactor * weatherFactor),
    confidenceInterval: [lower, upper],
    modelVersion: 'v3.2',
  };
}
```

## Technology Evolution

| Component | 2015 Stack | 2025 Stack |
|-----------|-----------|------------|
| Language | JavaScript (ES5) | TypeScript (ESM, strict) |
| ORM | Sequelize / Mongoose | Prisma |
| Testing | Mocha + Chai | Vitest + Supertest |
| Real-time | Socket.IO v1 | Socket.IO v4 with adapters |
| Containerization | Docker (new) | Docker Compose + Kubernetes |
| Monitoring | Console logs | Structured logging + OpenTelemetry |

## Industry Milestones

- **2015**: UberEats launches; basic dispatch algorithm
- **2017**: DoorDash introduces "Dasher" batching
- **2019**: Deliveroo open-sources "Frank" dispatch algorithm
- **2021**: Uber uses ML for 99.5% ETA accuracy
- **2023**: AI-powered dynamic pricing becomes standard
- **2025**: Drone delivery pilots (Wing, Amazon Prime Air)
