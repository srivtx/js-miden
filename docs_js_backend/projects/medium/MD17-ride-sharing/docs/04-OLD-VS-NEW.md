# Old vs New: Ride Sharing Tech (2015 vs 2025)

## Architecture Patterns

| Aspect | 2015 Approach | 2025 Approach |
|--------|---------------|---------------|
| **API Framework** | Express 4 with callbacks | Express 5 + async/await + ESM |
| **Database** | MySQL / MongoDB | PostgreSQL + Prisma (type-safe) |
| **Real-time** | Socket.IO v1 | Socket.IO v4 + Redis adapter |
| **Dispatch** | Greedy nearest-neighbor | Batch optimization (Uber), ML prediction |
| **Surge Pricing** | Fixed thresholds | ML-driven dynamic pricing |
| **ETA** | Google Maps API | ML models + historical traffic patterns |
| **Location** | Poll every 10s | Push with interpolation + Kalman filtering |

## Code Comparison

### Surge Pricing (2015 vs 2025)

**2015 (Non-atomic, race-prone):**
```javascript
// Express 4, separate queries
app.get('/fare', function(req, res) {
  db.query('SELECT COUNT(*) FROM rides WHERE status = ?', ['REQUESTED'], function(err, demand) {
    if (err) return res.status(500).send(err);
    
    // Race window here!
    db.query('SELECT COUNT(*) FROM drivers WHERE available = 1', function(err2, supply) {
      if (err2) return res.status(500).send(err2);
      
      const ratio = demand[0].count / supply[0].count;
      const surge = ratio > 2 ? 2.5 : ratio > 1.5 ? 2.0 : 1.0;
      res.json({ surge });
    });
  });
});
```

**2025 (Atomic transaction):**
```typescript
// Express 5, atomic read
app.get('/fare', async (req, res) => {
  const { demand, supply } = await prisma.$transaction(async (tx) => {
    const demandResult = await tx.ride.groupBy({
      by: ['status'],
      where: { status: 'REQUESTED' },
      _count: { status: true },
    });
    const supplyResult = await tx.driver.count({ where: { isAvailable: true } });
    return { demand: demandResult[0]?._count.status || 0, supply: supplyResult || 1 };
  });
  
  const ratio = demand / supply;
  const surge = ratio > 2 ? 2.5 : ratio > 1.5 ? 2.0 : 1.0;
  res.json({ surge });
});
```

### Driver Location Updates (2015 vs 2025)

**2015:**
```javascript
// Always overwrite
app.patch('/drivers/:id/location', function(req, res) {
  db.query('UPDATE drivers SET lat = ?, lng = ? WHERE id = ?', 
    [req.body.lat, req.body.lng, req.params.id], function(err) {
    if (err) return res.status(500).send(err);
    res.json({ success: true });
  });
});
```

**2025:**
```typescript
// Timestamp validation
app.patch('/drivers/:id/location', async (req, res) => {
  const driver = await prisma.driver.findUnique({ where: { id: req.params.id } });
  
  if (driver.updatedAt && req.body.timestamp <= driver.updatedAt.getTime()) {
    return res.status(409).json({ error: 'Stale location update' });
  }
  
  await prisma.driver.update({
    where: { id: req.params.id },
    data: { latitude: req.body.lat, longitude: req.body.lng },
  });
  
  res.json({ success: true });
});
```

### Dispatch Algorithm (2015 vs 2025)

**2015 (Greedy nearest-neighbor):**
```javascript
function findNearestDriver(pickupLat, pickupLng, drivers) {
  let nearest = null;
  let minDist = Infinity;
  
  drivers.forEach(driver => {
    const dist = haversine(pickupLat, pickupLng, driver.lat, driver.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = driver;
    }
  });
  
  return nearest;
}
```

**2025 (Batch optimization with ML):**
```typescript
function optimizeBatch(rides: Ride[], drivers: Driver[]) {
  // Build cost matrix: each ride-driver pair
  const costMatrix = rides.map(ride => 
    drivers.map(driver => ({
      rideId: ride.id,
      driverId: driver.id,
      cost: mlPredictedCost(ride, driver), // ML model
    }))
  );
  
  // Hungarian algorithm / linear programming for optimal assignment
  return hungarianAlgorithm(costMatrix);
}
```

## Technology Evolution

| Component | 2015 Stack | 2025 Stack |
|-----------|-----------|------------|
| Language | JavaScript (ES5) | TypeScript (strict, ESM) |
| ORM | Sequelize / Mongoose | Prisma |
| Testing | Mocha + Chai | Vitest + Supertest |
| Containerization | Docker (basic) | Docker Compose + K8s |
| Monitoring | Custom logs | OpenTelemetry + Prometheus |
| ML Platform | None | TensorFlow Serving / Michelangelo |

## Industry Milestones

- **2015**: Uber launches UberPool; basic batching
- **2016**: Lyft introduces "Prime Time" surge pricing
- **2017**: Didi handles 25M+ rides/day with real-time dispatch
- **2018**: Uber open-sources Michelangelo ML platform
- **2019**: Uber uses reinforcement learning for dispatch optimization
- **2021**: Lyft achieves 99.5% ETA accuracy with ML
- **2023**: AI copilots for driver assistance become standard
- **2025**: Autonomous vehicle dispatch pilots (Waymo, Cruise)
