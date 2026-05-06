# MD17 Ride Sharing — v1 Simple JS

## Goal
Get a ride-sharing API running in plain JavaScript with minimal friction.

## Stack
- Node.js 18+
- Express 4 (CommonJS)
- SQLite (file-based)

## File Structure
```
src/
  app.js
  routes/
    rides.js
    drivers.js
    riders.js
  db.js
package.json
```

## Key Code

### `src/db.js`
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dev.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS rides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rider_id TEXT,
    driver_id TEXT,
    status TEXT DEFAULT 'REQUESTED',
    pickup_address TEXT,
    dropoff_address TEXT,
    total_fare REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = { db };
```

### `src/routes/rides.js`
```javascript
const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.post('/', (req, res) => {
  const { riderId, pickupAddress, dropoffAddress } = req.body;
  // No fare calculation — just store it
  db.run(
    'INSERT INTO rides (rider_id, pickup_address, dropoff_address, total_fare) VALUES (?, ?, ?, ?)',
    [riderId, pickupAddress, dropoffAddress, 0],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

router.patch('/:id/accept', (req, res) => {
  const { driverId } = req.body;
  // No atomic check — two drivers can accept simultaneously
  db.run(
    'UPDATE rides SET driver_id = ?, status = ? WHERE id = ?',
    [driverId, 'ACCEPTED', req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

module.exports = router;
```

### `src/app.js`
```javascript
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/rides', require('./routes/rides'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/riders', require('./routes/riders'));
app.listen(3001, () => console.log('MD17 v1 running on 3001'));
```

## What Works
- Riders can request rides
- Drivers can accept rides (naive)
- Basic CRUD for drivers and riders

## What’s Missing
- No fare calculation or distance logic
- No surge pricing
- No validation — crashes on bad input
- No tracking or real-time updates
