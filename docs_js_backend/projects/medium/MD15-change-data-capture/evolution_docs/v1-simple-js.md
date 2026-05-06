# MD15 Change Data Capture — v1 Simple JS

## Overview
A naive polling approach in plain JavaScript. A cron job runs `SELECT * FROM users WHERE updated_at > ?` every 5 seconds. This misses rapid changes, cannot detect deletes, and places load on PostgreSQL.

## Files
```
src/
  poller.js
  routes/
    users.js
package.json
```

## Code Snippet
```javascript
// src/poller.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let lastChecked = new Date(0);

setInterval(async () => {
  const result = await pool.query(
    'SELECT * FROM users WHERE updated_at > $1',
    [lastChecked]
  );
  for (const row of result.rows) {
    console.log('Changed user:', row);
  }
  lastChecked = new Date();
}, 5000);
```

## What We Learn
- Polling is inefficient: most queries return zero rows.
- `updated_at` misses DELETEs and rapid sequential updates.
- Timestamp-based offsets suffer from clock skew.

## Next Step
Add TypeScript (v2) so we can model `ChangeEvent` and `ConsumerOffset` with types.
