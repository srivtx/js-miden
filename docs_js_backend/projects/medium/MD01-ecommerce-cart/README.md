# MD01: E-Commerce Cart

A production-ready e-commerce cart and checkout system with inventory management, idempotency, and order history.

## Architecture

- **Express 5** with TypeScript (ESM)
- **Prisma ORM** with PostgreSQL
- **Redis** for idempotency keys and session management
- **Zod** for request validation

## Thinking Framework

### Phase 1: Core Features
1. Shopping cart persistence (per user)
2. Add/remove/update items with inventory validation
3. Checkout flow with totals calculation (subtotal, tax, shipping)
4. Order creation and history

### Phase 2: Robustness
- **Inventory Race Condition**: The most critical bug in e-commerce. Two users buying the last item simultaneously.
- **Transactions**: Cart → Order → Inventory must be atomic.
- **Idempotency**: Prevent double-charging on network retries.
- **Cart Expiration**: Abandoned carts should expire to release inventory holds.

### Phase 3: Bug Analysis
**Intentional Bug: Race Condition in Inventory**

Located in `src/services/orderService.ts` in `createOrder()`.

The code reads product stock, validates it, then decrements stock in a separate `prisma.product.update()` call. This is a classic **read-check-write** race condition:

```typescript
// VULNERABLE CODE:
for (const item of cart.items) {
  const product = await prisma.product.findUnique({ where: { id: item.productId } });
  if (product.stock < item.quantity) { /* check */ }
  // Another order could decrement stock here!
  await prisma.product.update({
    where: { id: item.productId },
    data: { stock: { decrement: item.quantity } },
  });
}
```

**Impact**: Two concurrent orders both see `stock=1`, both pass validation, both decrement. Result: `stock=-1` (overselling).

**Fix**: Wrap inventory check and decrement in a transaction using `SELECT FOR UPDATE`:
```typescript
await prisma.$transaction(async (tx) => {
  const product = await tx.product.findUnique({
    where: { id: item.productId },
  });
  if (product.stock < item.quantity) throw new Error('Out of stock');
  await tx.product.update({
    where: { id: item.productId },
    data: { stock: { decrement: item.quantity } },
  });
});
```

Or use an atomic decrement with a constraint:
```typescript
await prisma.$executeRaw`
  UPDATE products SET stock = stock - ${item.quantity}
  WHERE id = ${item.productId} AND stock >= ${item.quantity}
`;
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List all products |
| GET | `/products/:id` | Get product details |
| GET | `/cart` | Get current cart with totals |
| POST | `/cart/items` | Add item to cart |
| PATCH | `/cart/items/:itemId` | Update item quantity |
| DELETE | `/cart/items/:itemId` | Remove item from cart |
| DELETE | `/cart` | Clear cart |
| POST | `/orders/checkout` | Checkout cart (creates order) |
| GET | `/orders` | Get order history |
| GET | `/orders/:id` | Get order details |
| GET | `/health` | Health check |

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL and Redis
docker-compose up -d

# Run migrations
npx prisma migrate dev

# Seed data (optional)
npm run db:seed

# Run tests
npm test

# Start development server
npm run dev
```

## Environment Variables

```env
DATABASE_URL=postgresql://ecommerce:ecommerce123@localhost:5432/ecommerce
REDIS_URL=redis://localhost:6379
PORT=3000
```

## Testing the Bug

Run two simultaneous checkout requests for the last item in stock. Both will succeed, demonstrating the race condition.

```bash
curl -X POST http://localhost:3000/orders/checkout \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-1" \
  -d '{"idempotencyKey":"key-1","shippingAddress":{"street":"123","city":"NYC","country":"USA","postalCode":"10001"}}' &

curl -X POST http://localhost:3000/orders/checkout \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-2" \
  -d '{"idempotencyKey":"key-2","shippingAddress":{"street":"456","city":"LA","country":"USA","postalCode":"90001"}}' &
```
