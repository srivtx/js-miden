# The 3AM Page: The Critical Request Blocked

It's 3:00 AM. Payment processing is down.

**Monitoring:** "Payment API timing out. But health check passes."

You check the bulkhead:
```javascript
const pool = new Semaphore(100); // Shared pool for ALL requests

app.use(async (req, res, next) => {
  await pool.acquire();
  res.on('finish', () => pool.release());
  next();
});
```

**All requests share one pool.** Image uploads (slow, 30s) consume all 100 slots.

Payment requests (fast, 50ms) wait behind uploads. Time out.

**Critical functions blocked by non-critical ones.**
