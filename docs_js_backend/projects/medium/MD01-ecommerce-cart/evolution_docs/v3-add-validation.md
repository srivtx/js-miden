# MD01 E-Commerce Cart — v3 Adding Validation

## The Attack

You thought TypeScript was enough. Then a pentester sent this:

```json
POST /cart/user-1/add
{ "productId": "'; DROP TABLE products; --", "quantity": 999999 }
```

If you were concatenating SQL strings (and you were, in v1), your products table is gone. Even with parameterized queries, `quantity: 999999` would drain your entire inventory into one cart.

## The Fix: Defense in Depth

You validate at the edge, the service layer, and the database.

### 1. Request Validation (Zod)

```ts
import { z } from 'zod';

const addToCartSchema = z.object({
  productId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  quantity: z.number().int().min(1).max(99),
});

export type AddToCartRequest = z.infer<typeof addToCartSchema>;

// In route handler
app.post('/cart/:userId/add', async (req, res) => {
  const parsed = addToCartSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  // ...
});
```

`productId` is now alphanumeric only. No SQL injection. `quantity` is capped at 99. No inventory draining.

### 2. Business Rule Validation

```ts
async function addItem(userId: string, productId: string, quantity: number): Promise<Cart> {
  // Check product exists
  const product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
  if (!product.rows[0]) throw new Error('Product not found');

  // Check stock
  if (product.rows[0].stock_quantity < quantity) {
    throw new Error('Insufficient stock');
  }

  // Check cart limit (prevent abuse)
  const cart = await getCart(userId);
  const totalItems = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  if (totalItems + quantity > 50) {
    throw new Error('Cart limit exceeded');
  }

  // Check for duplicate — merge instead of append
  const existing = cart.items.find(i => i.productId === productId);
  if (existing) {
    await db.query(
      'UPDATE cart_items SET quantity = quantity + $1 WHERE cart_id = $2 AND product_id = $3',
      [quantity, cart.id, productId]
    );
  } else {
    await db.query(
      'INSERT INTO cart_items (cart_id, product_id, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)',
      [cart.id, productId, quantity, product.rows[0].price_cents]
    );
  }

  return getCart(userId);
}
```

### 3. Database Constraints

```sql
CREATE TABLE cart_items (
  cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
  product_id VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  PRIMARY KEY (cart_id, product_id)
);
```

The database enforces:
- Quantity must be 1–99
- No duplicate product per cart (composite PK)
- Price must be non-negative

## The Bug

You validate stock at add time. But what if two users add the last item simultaneously?

```
T1: read stock → 1
T2: read stock → 1
T1: insert cart_item (passes, stock was 1)
T2: insert cart_item (passes, stock was 1)
```

Both carts have the item. Only one can checkout. You'll need transactions for that.

**Next:** Let's add logging so we can see when validation fails and why.
