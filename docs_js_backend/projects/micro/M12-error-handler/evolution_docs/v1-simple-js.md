# v1-simple-js.md — Error Handler

## The Naive Beginning

We built an API with several endpoints. No error handling — just raw Express:

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

app.post('/divide', (req, res) => {
  const { a, b } = req.body;
  res.json({ result: a / b });  // crashes if b === 0 or a/b aren't numbers
});

app.get('/async-error', async (req, res) => {
  const data = await fetchFromDatabase();  // might throw
  res.json(data);
});

app.listen(3000);
```

## The Hidden Bug

**PAIN:** When anything goes wrong, the entire Node.js process crashes:

1. **Division by zero** returns `Infinity` silently instead of a clean error.
2. **Invalid input** (`a: "foo"`) returns `NaN` — the client has no idea what happened.
3. **Async errors** crash the process with an unhandled promise rejection:
   ```
   node:internal/process/promises:288
           triggerUncaughtException(err, true /* fromPromise */);
   Error: Database connection lost
   ```
   One bad database connection kills every in-flight request.

## Why We Added Complexity

We needed:
- **A global error handler** so errors become responses, not crashes
- **Consistent error format** so clients know what to expect
- **Async error catching** so promises don't crash the process

> **Lesson:** Without an error handler, every unhandled exception is a production outage. Node.js crashes. All users are disconnected.
