# v1-simple-js.md — "I just want it to work"

## The 10-Minute Version

Your ops team needs a health check for the load balancer. You write the simplest thing possible:

```js
// server.js
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

**"This works. It returns 200. The load balancer is happy. Ship it."**

## The 3am Page

The database connection pool fills up. Queries start timing out. Your application is effectively down — but the load balancer keeps sending traffic because `/health` still returns `200`. Users see timeouts and 500 errors while your servers are marked "healthy."

You restart the database. Things get better. But you have no idea what happened because the health check never told anyone the database was sick.

## The Bug You Can't See

You add a "real" check:

```js
app.get('/health', (req, res) => {
  db.query('SELECT 1');
  redis.ping();
  res.json({ status: 'ok' });
});
```

This looks better. But `db.query` returns a Promise. You never `await` it. The database could be on fire and you'd still return `ok` because you're not waiting for the result. The `.catch()` you meant to add? You forgot it. An unhandled rejection crashes the process.

This is worse than the static 200 — now you have the *illusion* of depth.

## What We Have

- **Static 200** — lies to the load balancer
- **Fire-and-forget queries** — crashes the process, still returns ok
- **No dependency checks** — Redis down? Nobody knows
- **No caching** — every health check hammers the database

## What We Need

Real health checks that actually check things. Proper async handling. Caching so we don't DDoS ourselves. And connection pooling so we don't exhaust resources.
