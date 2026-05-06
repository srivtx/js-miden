# MD01: Idempotency in Cart Operations

## The Problem: Exactly-Once Semantics

Network requests fail ambiguously. A user clicks "Add to Cart" and the connection drops. Did the server receive the request? If the client retries, will the item be added twice?

> "At least once delivery is easy. Exactly once is impossible. At least once with idempotency is the practical solution." — Adapted from Jay Kreps, *I Heart Logs* (2014).

This is especially critical for:
- Adding items (don't double the quantity)
- Checkout (don't charge twice)
- Removing items (don't error on second retry)

## Idempotency Keys

An **idempotency key** is a unique client-generated identifier for an operation. The server records processed keys and ignores duplicates.

```
Client Request:
  POST /cart/items
  Headers:
    Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
    Idempotency-Key-Expires: 24h
  Body: { productId: "prod-123", quantity: 2 }
```

### Server-Side Storage

```sql
CREATE TABLE idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    request_method VARCHAR(10) NOT NULL,
    request_path VARCHAR(255) NOT NULL,
    request_body_hash VARCHAR(64) NOT NULL,  -- SHA-256
    response_status INT NOT NULL,
    response_body JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

### Processing Logic

```javascript
async function handleAddToCart(req, res) {
  const idempotencyKey = req.headers['idempotency-key'];

  if (idempotencyKey) {
    // 1. Check if already processed
    const existing = await db.query(
      'SELECT * FROM idempotency_keys WHERE key = $1',
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      const record = existing.rows[0];
      // Verify the request is identical
      const bodyHash = sha256(JSON.stringify(req.body));
      if (record.request_body_hash !== bodyHash) {
        return res.status(409).json({
          error: 'Idempotency key reused with different payload'
        });
      }
      // Return cached response
      return res.status(record.response_status).json(record.response_body);
    }
  }

  // 2. Execute the actual business logic
  const result = await db.transaction(async (trx) => {
    // ... add to cart logic ...
    return { cartId: 'cart-123', itemId: 'item-456' };
  });

  // 3. Store idempotency record (if key provided)
  if (idempotencyKey) {
    await db.query(
      `INSERT INTO idempotency_keys
       (key, request_method, request_path, request_body_hash,
        response_status, response_body, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours')`,
      [
        idempotencyKey,
        req.method,
        req.path,
        sha256(JSON.stringify(req.body)),
        200,
        JSON.stringify(result)
      ]
    );
  }

  res.json(result);
}
```

## The Stripe Model

Stripe's API is the gold standard for idempotency. Key behaviors:
1. Keys are valid for 24 hours.
2. Reusing a key with a different payload returns `409 Conflict`.
3. Keys are scoped to the account (not globally unique).
4. If the original request is still processing, subsequent requests return `409` with `Idempotency-Key-In-Use` header.

We adopt the same pattern.

## Idempotency in Checkout (Payment Critical)

Checkout is the most dangerous place for duplicate requests. A double-charge is a financial and legal liability.

```sql
-- Within the checkout transaction
BEGIN;

-- 1. Lock the idempotency key first
INSERT INTO idempotency_keys (key, ..., status)
VALUES ('key-abc', ..., 'processing')
ON CONFLICT (key) DO NOTHING;

-- If no rows inserted, key exists; handle accordingly
GET DIAGNOSTICS inserted_count = ROW_COUNT;
IF inserted_count = 0 THEN
    -- Check if completed or still processing
    SELECT status INTO key_status FROM idempotency_keys WHERE key = 'key-abc';
    IF key_status = 'completed' THEN
        RETURN cached_response;
    ELSE
        RAISE EXCEPTION 'Request already in progress';
    END IF;
END IF;

-- 2. Process payment (external call, outside transaction!)
-- NOTE: In practice, call payment gateway BEFORE the inventory transaction,
-- or use a two-phase commit (Saga) if the gateway supports it.

-- 3. If payment succeeds, finalize
UPDATE idempotency_keys SET status = 'completed', ... WHERE key = 'key-abc';

COMMIT;
```

## Handling In-Progress Requests

```javascript
// Timeline scenario:
// T0: Client sends Request 1 with Key=K
// T1: Server begins processing Request 1 (slow inventory check)
// T2: Client times out, retries Request 2 with Key=K
// T3: Server receives Request 2

// Correct behavior: Request 2 should wait or fail, not start a second checkout
if (record.status === 'processing') {
  res.status(409)
     .set('Idempotency-Key-In-Use', 'true')
     .json({ error: 'Previous request still processing' });
}
```

## Client-Side Idempotency Key Generation

```javascript
// Browser / Mobile client
function generateIdempotencyKey() {
  // UUID v4 (random) is sufficient
  return crypto.randomUUID();
}

// Store in localStorage so retries use the same key
const key = localStorage.getItem('pending-checkout-key')
         || generateIdempotencyKey();
localStorage.setItem('pending-checkout-key', key);

fetch('/checkout', {
  method: 'POST',
  headers: { 'Idempotency-Key': key },
  body: JSON.stringify(cartData)
}).then(response => {
  if (response.ok) {
    localStorage.removeItem('pending-checkout-key');
  }
});
```

## CAP Theorem Implication

Idempotency storage is a **write-once, read-many** workload. Under a network partition:
- If we prioritize **Availability**, two partitioned nodes might both accept the same key with different payloads (inconsistent).
- If we prioritize **Consistency**, a partitioned node must reject writes it cannot verify.

We choose **Consistency** for checkout idempotency. The idempotency table lives in the primary database (PostgreSQL), not a cache.

## Mathematical Foundation

An operation `f` is idempotent if:

> `f(f(x)) = f(x)`

For our cart:
- `addItem(cart, item, qty=2)` is NOT idempotent by default (2+2=4).
- `setItemQuantity(cart, item, qty=2)` IS idempotent (2→2 is 2).
- `removeItem(cart, item)` IS idempotent (removing twice is the same as once).

Therefore, the idempotency key wrapper makes the HTTP endpoint idempotent, even if the underlying SQL operation is not naturally so.
