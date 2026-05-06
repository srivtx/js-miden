# MD19 Real Estate — v1 Simple JS

## Goal
Build a basic real estate listing API in plain JavaScript.

## Stack
- Node.js 18+
- Express 4 (CommonJS)
- SQLite

## File Structure
```
src/
  app.js
  routes/
    listings.js
    tours.js
    agents.js
  db.js
package.json
```

## Key Code

### `src/db.js`
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dev.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    price REAL,
    beds INTEGER,
    baths INTEGER,
    property_type TEXT,
    status TEXT DEFAULT 'ACTIVE',
    latitude REAL,
    longitude REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = { db };
```

### `src/routes/listings.js`
```javascript
const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const { location } = req.query;
  let sql = 'SELECT * FROM listings WHERE status = ?';
  let params = ['ACTIVE'];
  if (location) {
    sql += ' AND (address LIKE ? OR city LIKE ?)';
    params.push(`%${location}%`, `%${location}%`);
  }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

module.exports = router;
```

### `src/app.js`
```javascript
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/listings', require('./routes/listings'));
app.use('/api/tours', require('./routes/tours'));
app.use('/api/agents', require('./routes/agents'));
app.listen(3003, () => console.log('MD19 v1 running on 3003'));
```

## What Works
- Listings can be created and searched (naive LIKE)
- Tours can be scheduled
- Agents can be listed

## What’s Missing
- No geospatial search
- No mortgage calculator
- No full-text search
- No validation
