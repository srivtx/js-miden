# MD16 Food Delivery — v1 Simple JS

## Goal
Get a food delivery API running in plain JavaScript with zero tooling overhead.

## Stack
- Node.js 18+
- Express 4 (CommonJS)
- SQLite (file-based, no Docker needed)

## File Structure
```
src/
  app.js
  routes/
    orders.js
    restaurants.js
    drivers.js
  db.js
package.json
```

## Key Code

### `src/db.js`
```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../dev.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT,
    restaurant_id TEXT,
    driver_id TEXT,
    status TEXT DEFAULT 'PLACED',
    total REAL,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = { db };
```

### `src/routes/orders.js`
```javascript
const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.post('/', (req, res) => {
  const { customerId, restaurantId, items, address } = req.body;
  // No inventory check — naive insert
  db.run(
    'INSERT INTO orders (customer_id, restaurant_id, total, address) VALUES (?, ?, ?, ?)',
    [customerId, restaurantId, 0, address],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

router.patch('/:id/assign', (req, res) => {
  const { driverId } = req.body;
  // Race condition: two drivers can overwrite each other
  db.run(
    'UPDATE orders SET driver_id = ?, status = ? WHERE id = ?',
    [driverId, 'PICKED_UP', req.params.id],
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
app.use('/api/orders', require('./routes/orders'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/drivers', require('./routes/drivers'));

app.listen(3000, () => console.log('MD16 v1 running on 3000'));
```

## What Works
- Customers can place orders
- Restaurants can be listed
- Drivers can be "assigned" (naive UPDATE)

## What’s Missing
- No types → runtime errors on bad payloads
- No validation → crashes on malformed JSON
- No transactions → inventory not decremented atomically
- No error handling → 500s leak stack traces
- No tests → regressions go unnoticed
