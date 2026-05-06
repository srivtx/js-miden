# WRONG vs RIGHT: Bulkhead Pattern

## The Bug: Shared Pool

### Wrong (Current Code)

```typescript
// src/pool.ts
const sharedPool = new Pool('shared', 3);

// src/bulkhead.ts
function handleCritical(req, res) {
  if (sharedPool.hasCapacity()) {
    sharedPool.acquire();
    // ... handle request
  } else {
    res.status(503).send('Pool full');
  }
}

function handleBackground(req, res) {
  if (sharedPool.hasCapacity()) {
    sharedPool.acquire();
    // ... handle request
  } else {
    res.status(503).send('Pool full');
  }
}
```

**Why It's Wrong:**
- Background jobs and critical requests compete for the same slots.
- If 3 background jobs are running, critical requests are rejected.
- The bulkhead provides no protection or isolation.

### Right (Fixed Code)

```typescript
// src/pool.ts
const pools = {
  critical: new Pool('critical', 3),
  background: new Pool('background', 3),
};

// src/bulkhead.ts
function handle(poolName: string, req, res, handler) {
  const pool = pools[poolName];
  if (!pool) {
    res.status(400).send('Unknown pool');
    return;
  }
  if (pool.hasCapacity()) {
    pool.acquire();
    handler(req, res).finally(() => pool.release());
  } else {
    res.status(503).send(`Pool ${poolName} is full`);
  }
}

// Routes
app.get('/critical', (req, res) => {
  handle('critical', req, res, processCritical);
});

app.get('/background', (req, res) => {
  handle('background', req, res, processBackground);
});
```

**Why It's Right:**
- Each workload type has its own dedicated pool.
- Background job exhaustion does not affect critical requests.
- True isolation is achieved.

## Key Takeaway

A bulkhead with a shared pool is not a bulkhead at all. True isolation requires separate, independent resource limits for each workload type.
