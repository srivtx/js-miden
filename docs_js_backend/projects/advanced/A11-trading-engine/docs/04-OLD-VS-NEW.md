# A11 Trading Engine: Old vs New (2015 vs 2025)

## 2015 Approach: Monolithic, Blocking, Vulnerable

### Architecture
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Trader    │─────▶│  Express     │─────▶│  PostgreSQL  │
│   (Browser) │◀─────│  Monolith    │◀─────│  (1 instance)│
└─────────────┘      └──────────────┘      └──────────────┘
```

### Characteristics
- **Single-threaded Node.js**: All symbols share one event loop
- **Blocking database calls**: `await pool.query(...)` stalls the loop
- **No validation**: Trust the client, validate later (maybe)
- **Manual locking**: Developer-managed mutexes (`async-mutex`)
- **Deploy**: Git push to single VPS, `pm2 restart`

### Code (2015 Style)
```javascript
// 2015: Callbacks, no types, no validation
app.post('/orders', function(req, res) {
  db.query('INSERT INTO orders ...', req.body, function(err, result) {
    if (err) return res.status(500).send(err);
    matchOrder(result.rows[0], function(err, trades) {
      if (err) return res.status(500).send(err);
      res.json(trades);
    });
  });
});
```

### Problems
1. Callback hell makes error handling impossible
2. No types means `req.body.price` could be `"free"` and you'd never know
3. Single DB instance is a single point of failure
4. No connection pooling = database overload under load

---

## 2025 Approach: Sharded, Lock-Free, Validated

### Architecture
```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Trader    │─────▶│  API Gateway │─────▶│  Symbol      │
│   (Browser) │◀─────│  (Kong/AWS)  │◀─────│  Shards      │
└─────────────┘      └──────┬───────┘      └──────┬───────┘
                            │                     │
                            ▼                     ▼
                     ┌──────────────┐      ┌──────────────┐
                     │  Redis       │      │  PostgreSQL  │
                     │  (Pub/Sub)   │      │  (Primary-   │
                     │              │      │   Replica)   │
                     └──────────────┘      └──────────────┘
```

### Characteristics
- **Worker threads / separate processes**: Each symbol runs in isolation
- **Non-blocking I/O**: Native Node.js, but with backpressure handling
- **Strict validation**: Zod schemas at the edge
- **Database-level locking**: Advisory locks, atomic CAS, or serializable transactions
- **Deploy**: Kubernetes, blue-green deployment, circuit breakers

### Code (2025 Style)
```typescript
// 2025: Type-safe, validated, atomic
const OrderSchema = z.object({
  symbol: z.string().regex(/^[A-Z]{1,5}$/),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['limit', 'market']),
  price: z.number().positive().optional(),
  quantity: z.number().positive().int(),
});

app.post('/orders', async (req, res) => {
  const input = OrderSchema.parse(req.body); // Throws on invalid
  const order = await db.createOrder(input);
  
  // Route to symbol-specific worker
  const shard = getShard(order.symbol);
  const trades = await shard.match(order);
  
  res.status(201).json({ order, trades });
});
```

### Evolution Summary

| Aspect | 2015 | 2025 |
|--------|------|------|
| Language | JavaScript (ES5) | TypeScript (strict) |
| Validation | Manual, optional | Zod/Joi, mandatory at edge |
| Concurrency | Single event loop | Worker threads, clustering |
| Persistence | Raw SQL | Prisma/Drizzle + migrations |
| Deployment | PM2 on VPS | Kubernetes, serverless |
| Monitoring | Console.log | OpenTelemetry, structured logs |
| Testing | Manual | Vitest, property-based testing |
| Security | Hope | Zero-trust, WAF, rate limiting |

## What Didn't Change

- **Price-time priority**: Unchanged since the 1870s NYSE
- **Double-entry bookkeeping**: Every trade has two sides
- **The need for audit trails**: Regulators still want logs

## What Changed Dramatically

- **Latency expectations**: 2015: 10ms was fine. 2025: 10us is slow.
- **Regulatory burden**: MiFID II, SEC Rule 613 (CAT) require nanosecond timestamps
- **Crypto influence**: 24/7 markets, atomic swaps, AMMs as alternatives to order books
