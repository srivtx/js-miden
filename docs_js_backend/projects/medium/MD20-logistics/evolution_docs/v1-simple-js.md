# MD20 Logistics — v1 Simple JS

## Goal
Build a basic logistics/shipment tracking API in plain JavaScript.

## Stack
- Node.js 18+
- Express 4 (CommonJS)
- SQLite

## File Structure
```
src/
  app.js
  routes/
    shipments.js
    tracking.js
    warehouses.js
  db.js
package.json
```

## Key Code

### `src/db.js`
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dev.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_number TEXT,
    status TEXT DEFAULT 'CREATED',
    origin_id TEXT,
    destination_id TEXT,
    weight REAL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER,
    status TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = { db };
```

### `src/routes/shipments.js`
```javascript
const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.post('/', (req, res) => {
  const { originId, destinationId, weight, createdBy } = req.body;
  const trackingNumber = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
  db.run(
    'INSERT INTO shipments (tracking_number, origin_id, destination_id, weight, created_by) VALUES (?, ?, ?, ?, ?)',
    [trackingNumber, originId, destinationId, weight, createdBy],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, trackingNumber });
    }
  );
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  // BUG: tracking event not created atomically
  db.run(
    'UPDATE shipments SET status = ? WHERE id = ?',
    [status, req.params.id],
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
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/warehouses', require('./routes/warehouses'));
app.listen(3004, () => console.log('MD20 v1 running on 3004'));
```

## What Works
- Shipments can be created with auto-generated tracking numbers
- Status can be updated (naively)
- Warehouses can be listed

## What’s Missing
- No atomic status + tracking update
- No route optimization
- No inventory sync
- No validation
