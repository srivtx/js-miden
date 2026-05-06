# v1: Simple JS — Metrics Collector

## The Pain

You want to know how slow your API is. You add `console.log`:

```javascript
// src/api.js
app.get('/api/users', (req, res) => {
  const start = Date.now();
  // ... fetch users ...
  const duration = Date.now() - start;
  console.log(`/api/users took ${duration}ms`);
  res.json(users);
});
```

You deploy. The logs are full of:

```
/api/users took 45ms
/api/users took 120ms
/api/users took 45ms
/api/users took 5000ms
/api/orders took 30ms
```

You can't answer:
- What's the average response time?
- What's the 95th percentile?
- How many requests hit `/api/users` in the last 5 minutes?
- Is the API getting slower over time?

You try to grep and awk the logs. It takes 10 minutes per question. You give up.

## The Solution (v1)

Build a simple in-memory metrics collector.

```javascript
// src/metrics-collector.js
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
  }

  record(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push({ value, timestamp: Date.now() });
  }

  getMetrics(name) {
    const records = this.metrics.get(name) || [];
    if (records.length === 0) return null;

    const values = records.map(r => r.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count,
      sum,
      avg: sum / count,
      min: values[0],
      max: values[count - 1],
    };
  }
}

module.exports = { MetricsCollector };
```

```javascript
// src/index.js
const express = require('express');
const { MetricsCollector } = require('./metrics-collector');

const app = express();
app.use(express.json());

const collector = new MetricsCollector();

app.post('/metrics', (req, res) => {
  const { name, value } = req.body;
  collector.record(name, value);
  res.status(201).json({ recorded: true });
});

app.get('/metrics/:name', (req, res) => {
  const metrics = collector.getMetrics(req.params.name);
  if (!metrics) {
    return res.status(404).json({ error: 'No metrics found' });
  }
  res.json({ name: req.params.name, ...metrics });
});

app.listen(3000, () => {
  console.log('Metrics collector running on port 3000');
});
```

## What's Still Broken (and Why We Evolve)

- **No types**: `value: "fast"` is stored and breaks math.
- **No validation**: Missing `name` or `value` crashes on `sort()`.
- **No time windows**: All historical data is returned. Memory grows forever.
- **No percentiles**: You can't see p95 or p99.
- **No logs**: No audit trail of metric ingestion.
- **No tests**: Refactoring aggregation logic is risky.
- **CJS**: `require()` is legacy.
- **No tags**: You can't break down metrics by endpoint or region.

This is v1. It solves the "console.log is not queryable" pain. It introduces new pains that v2-v7 will fix.
