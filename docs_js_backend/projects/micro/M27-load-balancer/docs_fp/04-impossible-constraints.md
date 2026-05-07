# Impossible Constraint: No Health Checks

**Task:** Distribute load without knowing server health.

**Constraint:** You can't ping servers. You don't know if they're up.

---

## Your Turn

How do you avoid sending traffic to dead servers without health checks?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: Passive Health Checks

Instead of active pings, detect failures from actual requests:

```javascript
const serverStats = new Map();

function recordResult(server, success) {
  const stats = serverStats.get(server) || { requests: 0, failures: 0 };
  stats.requests++;
  if (!success) stats.failures++;
  serverStats.set(server, stats);
}

function isHealthy(server) {
  const stats = serverStats.get(server);
  if (!stats) return true;
  return stats.failures / stats.requests < 0.5;
}
```

**The point:** Health checks don't have to be active pings. You can learn from real traffic.

**Trade-off:** Slower detection. First few requests to a dead server fail.
