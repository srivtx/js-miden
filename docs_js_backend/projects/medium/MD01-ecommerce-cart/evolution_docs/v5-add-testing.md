# MD01 E-Commerce Cart — v5 Adding Testing

## The Bug

You "fixed" inventory reservation. You added:

```ts
await db.query(
  'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND stock_quantity >= $1',
  [quantity, productId]
);
```

You deploy. Black Friday hits. Users report: "I bought the item but got an email saying it's out of stock." You check. The UPDATE succeeds (stock was sufficient at check time). But between cart-add and checkout, another user bought the last unit. Your checkout doesn't re-verify stock.

Tests would have caught this.

## The Fix: Comprehensive Tests

### Unit Tests: Cart Logic

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CartService } from '../src/services/cartService';
import { InMemoryCartRepository } from '../src/repos/inMemoryCartRepo';
import { InMemoryProductRepository } from '../src/repos/inMemoryProductRepo';

describe('CartService', () => {
  let cartService: CartService;
  let productRepo: InMemoryProductRepository;

  beforeEach(() => {
    productRepo = new InMemoryProductRepository();
    cartService = new CartService(
      new InMemoryCartRepository(),
      productRepo
    );
  });

  it('merges duplicate items instead of appending', async () => {
    await cartService.addItem('user-1', 'shoes-42', 2);
    await cartService.addItem('user-1', 'shoes-42', 3);

    const cart = await cartService.getCart('user-1');
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(5);
  });

  it('rejects negative quantity', async () => {
    await expect(
      cartService.addItem('user-1', 'shoes-42', -1)
    ).rejects.toThrow('quantity must be positive');
  });

  it('rejects adding more than available stock', async () => {
    productRepo.setStock('shoes-42', 5);
    await expect(
      cartService.addItem('user-1', 'shoes-42', 10)
    ).rejects.toThrow('Insufficient stock');
  });

  it('preserves price snapshot at add time', async () => {
    productRepo.setPrice('shoes-42', 9999); // $99.99
    await cartService.addItem('user-1', 'shoes-42', 1);

    // Price changes to $79.99
    productRepo.setPrice('shoes-42', 7999);

    const cart = await cartService.getCart('user-1');
    expect(cart.items[0].unitPrice).toBe(9999); // Original price preserved
  });
});
```

### Integration Tests: Race Conditions

```ts
import { describe, it, expect } from 'vitest';
import { createTestDatabase } from './helpers/db';
import { CartService } from '../src/services/cartService';
import { PostgresCartRepository } from '../src/repos/postgresCartRepo';
import { PostgresProductRepository } from '../src/repos/postgresProductRepo';

describe('CartService concurrency', () => {
  it('prevents overselling with concurrent checkouts', async () => {
    const db = await createTestDatabase();
    const cartService = new CartService(
      new PostgresCartRepository(db),
      new PostgresProductRepository(db)
    );

    // Seed: 1 item in stock
    await db.query("INSERT INTO products (id, name, price_cents, stock_quantity, version) VALUES ('widget-1', 'Widget', 1000, 1, 1)");

    // Two users add to cart
    await cartService.addItem('user-a', 'widget-1', 1);
    await cartService.addItem('user-b', 'widget-1', 1);

    // Both try to checkout simultaneously
    const results = await Promise.allSettled([
      cartService.checkout('user-a'),
      cartService.checkout('user-b'),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes).toHaveLength(1); // Only one succeeds

    const product = await db.query('SELECT stock_quantity FROM products WHERE id = $1', ['widget-1']);
    expect(product.rows[0].stock_quantity).toBe(0); // Stock is exactly zero
  });
});
```

### Transaction Tests

```ts
it('rolls back cart on inventory failure', async () => {
  const db = await createTestDatabase();
  const cartService = new CartService(
    new PostgresCartRepository(db),
    new PostgresProductRepository(db)
  );

  await db.query("INSERT INTO products (id, name, price_cents, stock_quantity, version) VALUES ('rare-1', 'Rare Item', 5000, 1, 1)");
  await cartService.addItem('user-1', 'rare-1', 1);

  // Simulate inventory becoming zero between cart-add and checkout
  await db.query('UPDATE products SET stock_quantity = 0 WHERE id = $1', ['rare-1']);

  await expect(cartService.checkout('user-1')).rejects.toThrow('Insufficient stock');

  // Order should NOT exist
  const orders = await db.query('SELECT * FROM orders WHERE user_id = $1', ['user-1']);
  expect(orders.rows).toHaveLength(0);

  // Cart should still contain the item (user can try again later)
  const cart = await cartService.getCart('user-1');
  expect(cart.items).toHaveLength(1);
});
```

## What Tests Caught

- Duplicate item append → caught (merge logic)
- Stock overselling → caught (optimistic locking)
- Price snapshot failure → caught (unit test)
- Transaction rollback → caught (integration test)
- Cart limit bypass → caught (boundary test)

## The Confidence

Now you can refactor from SQLite to PostgreSQL, add Redis caching, or rewrite the checkout flow and know that:
1. Items merge correctly
2. Stock never goes negative
3. Prices are snapshot at add time
4. Failed checkouts don't leave partial orders

**Next:** Let's modernize the module system before the codebase grows.
