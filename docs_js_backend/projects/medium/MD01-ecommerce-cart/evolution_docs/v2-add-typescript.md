# MD01 E-Commerce Cart — v2 Adding TypeScript

## The Bug

You just spent three hours debugging why adding an item silently failed.

```js
app.post('/cart/:userId/add', (req, res) => {
  const { productId, quantity } = req.body;
  carts[userId].push({ productId, quantity });
});
```

A user sent:
```json
{ "productId": "shoes-42", "quantity": "2" }
```

`quantity` is a string. Downstream, your checkout does `quantity * price`. In JavaScript, `"2" * 19.99` works (coerces to number). But then you do `quantity + 1` to increment and get `"21"`. The cart shows 21 items. The inventory system expects a number. Everything breaks.

TypeScript would have caught this.

## The Fix: Types First

```ts
// types.ts
export interface CartItem {
  productId: string;
  quantity: number;
  addedAt: Date;
  unitPrice: number; // snapshot at add time
}

export interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: Date;
}

export interface AddToCartRequest {
  productId: string;
  quantity: number;
}
```

Now `quantity` is typed as `number`. If a client sends a string, TypeScript screams at compile time (or your validation layer rejects it at runtime).

## Modeling the Database Early

Before we write a single query, we design the schema:

```ts
// schema.ts
export interface ProductRow {
  id: string;
  name: string;
  price_cents: number;
  stock_quantity: number;
  version: number; // for optimistic locking
}

export interface CartRow {
  id: string; // UUID
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface CartItemRow {
  cart_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number;
  added_at: Date;
}
```

Notice `version` on Product. We'll need that later for inventory locking. Notice `price_cents` — never store money as float.

## The Cart Service Interface

```ts
// cartService.ts
export interface ICartService {
  getCart(userId: string): Promise<Cart>;
  addItem(userId: string, productId: string, quantity: number): Promise<Cart>;
  removeItem(userId: string, productId: string): Promise<Cart>;
  updateQuantity(userId: string, productId: string, quantity: number): Promise<Cart>;
  clearCart(userId: string): Promise<void>;
  checkout(userId: string): Promise<{ orderId: string }>;
}
```

This interface forces us to think about the API surface before implementation. It also makes testing trivial — we can mock `ICartService` for checkout tests.

## Why This Matters

TypeScript doesn't fix race conditions. It doesn't prevent double-booking. But it eliminates an entire class of bugs:
- Wrong property names (`productID` vs `productId`)
- Type coercion surprises (string + number)
- Missing fields in return values
- Refactoring breakage

**Next:** Let's add validation so we don't trust the client.
