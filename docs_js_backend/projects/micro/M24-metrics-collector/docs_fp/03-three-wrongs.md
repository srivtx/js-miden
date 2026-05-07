# Three Wrong Ways to Collect Metrics

---

## Wrong #1: Storing All Events

```javascript
const events = [];
app.use((req, res, next) => {
  events.push({ path: req.path, duration: Date.now() - start });
  next();
});
```

**Why it's wrong:** Unbounded memory growth. OOM guaranteed.

---

## Wrong #2: Synchronous Logging

```javascript
app.use((req, res, next) => {
  fs.appendFileSync('metrics.log', JSON.stringify(metric) + '\n');
  next();
});
```

**Why it's wrong:** Blocks the event loop. 1000 req/s = 1000 disk writes/s.

---

## Wrong #3: No Cardinality Limits

```javascript
// Metric: http_requests_total{path="/api/users/12345"}
// Each user ID creates a new time series!
```

**Why it's wrong:** 1 million users = 1 million time series. Metrics system explodes.

**Fix:** Limit cardinality. Use `/api/users/:id` as the path label.
