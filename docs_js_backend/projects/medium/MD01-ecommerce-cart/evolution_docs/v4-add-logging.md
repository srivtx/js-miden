# MD01 E-Commerce Cart — v4 Adding Logging

## The Incident

It's Black Friday. Cart conversion drops 40%. You have no idea why.

Users report: "I add items but they disappear." You check the database. The items are there. Then you realize: the mobile app has a bug where it calls `GET /cart` before `POST /cart/add` resolves. The GET returns stale data. The app overwrites the cart with the stale response.

If you had structured logs, you'd see the race condition in milliseconds.

## The Fix: Structured Logging + Metrics

```ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'password'],
});

// Cart operation logger
export function logCartOperation(
  operation: string,
  userId: string,
  productId: string,
  quantity: number,
  durationMs: number,
  success: boolean,
  error?: string
) {
  logger.info({
    event: 'cart_operation',
    operation,
    userId,
    productId,
    quantity,
    durationMs,
    success,
    error,
    timestamp: new Date().toISOString(),
  });
}
```

### Logging Every Critical Path

```ts
async function addItem(userId: string, productId: string, quantity: number): Promise<Cart> {
  const start = Date.now();
  try {
    logger.info({ event: 'cart_add_start', userId, productId, quantity });

    const product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (!product.rows[0]) {
      logCartOperation('add', userId, productId, quantity, Date.now() - start, false, 'Product not found');
      throw new Error('Product not found');
    }

    // ... validation and insert ...

    const cart = await getCart(userId);
    logCartOperation('add', userId, productId, quantity, Date.now() - start, true);
    return cart;
  } catch (err) {
    logCartOperation('add', userId, productId, quantity, Date.now() - start, false, (err as Error).message);
    throw err;
  }
}
```

### Inventory Audit Log

```ts
async function reserveInventory(productId: string, quantity: number, orderId: string): Promise<void> {
  logger.info({
    event: 'inventory_reserve',
    productId,
    quantity,
    orderId,
    timestamp: new Date().toISOString(),
  });

  const result = await db.query(
    'UPDATE products SET stock_quantity = stock_quantity - $1, version = version + 1 WHERE id = $2 AND stock_quantity >= $1 RETURNING stock_quantity',
    [quantity, productId]
  );

  if (result.rows.length === 0) {
    logger.warn({
      event: 'inventory_reserve_failed',
      productId,
      quantity,
      orderId,
      reason: 'insufficient_stock',
    });
    throw new Error('Insufficient stock');
  }

  logger.info({
    event: 'inventory_reserved',
    productId,
    quantity,
    orderId,
    remainingStock: result.rows[0].stock_quantity,
  });
}
```

## Observability: What to Log

| Event | Why |
|-------|-----|
| `cart_add_start` | Trace request entry |
| `cart_add_complete` | Measure latency |
| `inventory_reserve_failed` | Detect stockouts before they hurt conversion |
| `checkout_start` | Funnel analysis |
| `checkout_complete` | Revenue tracking |
| `checkout_abandoned` | Identify friction points |

## The Dashboard Query

```sql
-- Cart abandonment rate by step
SELECT
  event,
  COUNT(*) as count,
  AVG(duration_ms) as avg_latency_ms
FROM cart_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY event
ORDER BY avg_latency_ms DESC;
```

## The Bug

You log every cart operation. That's 10,000 logs per second on Black Friday. Your logging bill exceeds your server costs. You need sampling.

```ts
function shouldLog(): boolean {
  return Math.random() < 0.1; // 10% sample for high-volume events
}
```

But don't sample errors. Always log failures.

**Next:** Let's write tests so we can validate cart logic without deploying to production.
