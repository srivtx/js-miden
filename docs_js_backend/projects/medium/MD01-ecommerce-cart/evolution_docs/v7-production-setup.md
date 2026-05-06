# MD01 E-Commerce Cart — v7 Production Setup

Your cart works. It has types, validation, logs, tests, and ESM. But an e-commerce cart at production scale is a distributed systems problem. One wrong move and you oversell inventory, lose revenue, or corrupt customer data.

## Pain #1: SQLite Dies Under Load

You started with SQLite. It works for demos. At 100 concurrent checkout attempts, SQLite locks. Requests queue up. Response time goes from 50ms to 5 seconds. Customers abandon carts.

**Evolution: SQLite → PostgreSQL**

```ts
// prisma/schema.prisma
model Cart {
  id        String   @id @default(uuid())
  userId    String   @unique
  items     CartItem[]
  status    CartStatus @default(ACTIVE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([status, updatedAt])
}

model CartItem {
  id            String @id @default(uuid())
  cartId        String
  productId     String
  quantity      Int
  unitPriceCents Int
  addedAt       DateTime @default(now())

  cart     Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product  Product @relation(fields: [productId], references: [id])

  @@unique([cartId, productId])
}

model Product {
  id            String @id
  name          String
  priceCents    Int
  stockQuantity Int
  version       Int    @default(1) // optimistic locking

  @@index([stockQuantity])
}
```

PostgreSQL handles concurrent connections. Row-level locking prevents overselling.

**Evolution: Raw SQL → Prisma**

```ts
// Before: error-prone string queries
await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, id]);

// After: type-safe, auto-completed queries
await prisma.product.update({
  where: { id: productId },
  data: { stockQuantity: { decrement: quantity } },
});
```

Prisma generates TypeScript types from the schema. Rename a column? The compiler tells you every broken query.

**Evolution: Migrations**

```bash
npx prisma migrate dev --name add_cart_status
```

Migrations are versioned SQL files. Roll back safely. Review in PRs.

## Pain #2: Cart Data Lives in One Process

You scale to 3 Node servers behind a load balancer. User A adds an item to Server 1. User A's next request hits Server 2. The cart is empty. Users panic.

**Evolution: In-Memory → Redis**

```ts
// src/cache/redisCartCache.ts
import Redis from 'ioredis';

export class RedisCartCache {
  private redis = new Redis(process.env.REDIS_URL);
  private ttlSeconds = 3600 * 24 * 7; // 7 days

  async getCart(userId: string): Promise<Cart | null> {
    const data = await this.redis.get(`cart:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async setCart(userId: string, cart: Cart): Promise<void> {
    await this.redis.setex(`cart:${userId}`, this.ttlSeconds, JSON.stringify(cart));
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(`cart:${userId}`);
  }
}
```

Redis is shared across all servers. Cart data is consistent regardless of which server handles the request.

## Pain #3: Overselling Under Race Conditions

Two users check out the last widget simultaneously:

```
T1: read stock → 1
T2: read stock → 1
T1: create order, decrement stock → 0
T2: create order, decrement stock → -1 (OVERSOLD!)
```

**Evolution: Optimistic Locking → Database Transactions**

```ts
// Optimistic locking with version
async function reserveInventory(productId: string, quantity: number): Promise<void> {
  const result = await prisma.product.updateMany({
    where: {
      id: productId,
      stockQuantity: { gte: quantity },
    },
    data: {
      stockQuantity: { decrement: quantity },
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    throw new Error('Insufficient stock');
  }
}

// Full checkout transaction
async function checkout(userId: string): Promise<Order> {
  return await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // Reserve inventory for all items
    for (const item of cart.items) {
      await tx.product.updateMany({
        where: {
          id: item.productId,
          stockQuantity: { gte: item.quantity },
        },
        data: {
          stockQuantity: { decrement: item.quantity },
        },
      });
    }

    // Verify all reservations succeeded
    const updatedProducts = await tx.product.findMany({
      where: { id: { in: cart.items.map(i => i.productId) } },
    });

    for (const item of cart.items) {
      const product = updatedProducts.find(p => p.id === item.productId);
      if (!product || product.stockQuantity < 0) {
        throw new Error(`Inventory conflict for ${item.productId}`);
      }
    }

    // Create order
    const order = await tx.order.create({
      data: {
        userId,
        status: 'confirmed',
        items: {
          create: cart.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
          })),
        },
      },
    });

    // Clear cart
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return order;
  }, {
    isolationLevel: 'Serializable',
    maxWait: 5000,
    timeout: 10000,
  });
}
```

`Serializable` isolation means the database treats this transaction as if it ran alone. Concurrent checkouts for the same item are serialized. One succeeds, one fails with a retryable error.

## Pain #4: Architecture Spaghetti

Your route handler does everything: validation, database queries, inventory checks, payment calls, email sending. It's 200 lines. Changing payment logic breaks cart display.

**Evolution: Monolith → Layered → Service-Based**

```
┌─────────────────┐
│   API Routes    │  ← Express handlers, validation, auth
├─────────────────┤
│  Cart Service   │  ← Business logic, orchestration
├─────────────────┤
│ Cart Repository │  ← Database access (Prisma)
│ Product Repo    │
│ Order Repo      │
├─────────────────┤
│  Redis Cache    │  ← Shared state
│  PostgreSQL     │
└─────────────────┘
```

```ts
// src/services/cartService.ts
export class CartService {
  constructor(
    private cartRepo: ICartRepository,
    private productRepo: IProductRepository,
    private cache: ICartCache,
    private eventBus: IEventBus,
  ) {}

  async addItem(userId: string, productId: string, quantity: number): Promise<Cart> {
    const product = await this.productRepo.findById(productId);
    if (!product) throw new Error('Product not found');
    if (product.stockQuantity < quantity) throw new Error('Insufficient stock');

    const cart = await this.cartRepo.addItem(userId, productId, quantity, product.priceCents);
    await this.cache.setCart(userId, cart);

    return cart;
  }

  async checkout(userId: string): Promise<Order> {
    const order = await this.cartRepo.checkout(userId);
    await this.cache.invalidate(userId);
    await this.eventBus.publish('order.created', { orderId: order.id, userId });
    return order;
  }
}
```

The service layer doesn't know about HTTP, Redis, or PostgreSQL. It knows about carts and orders. You can swap the database without touching business logic.

## Pain #5: Inventory Deadlocks

Two users check out simultaneously, each buying Product A and Product B. Transaction 1 locks Product A, then tries Product B. Transaction 2 locks Product B, then tries Product A. Deadlock. Both roll back.

**Evolution: Consistent Lock Ordering**

```ts
async function reserveInventory(items: CartItem[], tx: PrismaTransaction): Promise<void> {
  // Sort by productId to ensure consistent lock order
  const sorted = [...items].sort((a, b) => a.productId.localeCompare(b.productId));

  for (const item of sorted) {
    await tx.product.updateMany({
      where: { id: item.productId, stockQuantity: { gte: item.quantity } },
      data: { stockQuantity: { decrement: item.quantity } },
    });
  }
}
```

Both transactions lock products in the same order. No circular wait. No deadlocks.

## Pain #6: Cart Abandonment

Users add items, never check out. Inventory is reserved forever. Other customers see "out of stock" for items sitting in abandoned carts.

**Evolution: Cart TTL + Inventory Release**

```ts
// Background job
async function releaseAbandonedCartInventory(): Promise<void> {
  const abandonedCarts = await prisma.cart.findMany({
    where: {
      status: 'ACTIVE',
      updatedAt: { lt: new Date(Date.now() - 1000 * 60 * 60 * 24) }, // 24h
    },
    include: { items: true },
  });

  for (const cart of abandonedCarts) {
    await prisma.$transaction(async (tx) => {
      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'ABANDONED' },
      });
    });

    await cache.invalidate(cart.userId);
  }
}

// Run every 5 minutes
setInterval(releaseAbandonedCartInventory, 5 * 60 * 1000);
```

## Final Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Gateway │────▶│   Express   │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
              ┌─────▼─────┐              ┌───────▼────────┐           ┌───────▼──────┐
              │  Cart     │              │   Inventory    │           │   Order      │
              │  Service  │              │   Service      │           │   Service    │
              └─────┬─────┘              └───────┬────────┘           └───────┬──────┘
                    │                            │                            │
              ┌─────▼─────┐              ┌───────▼────────┐           ┌───────▼──────┐
              │  Redis    │              │  PostgreSQL    │           │  PostgreSQL  │
              │  (Cache)  │              │  (Products)    │           │  (Orders)    │
              └───────────┘              └────────────────┘           └──────────────┘
```

## Production Checklist

- [ ] PostgreSQL with Prisma migrations
- [ ] Redis for cart caching (cross-server consistency)
- [ ] Serializable transactions for checkout
- [ ] Optimistic locking on products (`version` field)
- [ ] Consistent lock ordering to prevent deadlocks
- [ ] Cart TTL with inventory release job
- [ ] Layered architecture (routes → services → repos)
- [ ] Event bus for order notifications
- [ ] Database connection pooling (PgBouncer)
- [ ] Redis Sentinel for HA

This is a production e-commerce cart. It started as an in-memory array. Now it safely handles concurrent checkouts, prevents overselling, and scales across multiple servers.
