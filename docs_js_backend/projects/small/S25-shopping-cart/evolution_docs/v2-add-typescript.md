# v2-add-typescript

## Goal
Add static types before the cart logic grows branches for merge, expiry, and inventory.

## Changes
1. Rename `.js` → `.ts`.
2. Extract `Cart`, `CartItem`, and request types.
3. Add return types to all service functions.

## Code

```ts
// src/types.ts
export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}
```

```ts
// src/service.ts
import { Cart, CartItem } from './types.js';

const cartStore: Map<string, Cart> = new Map();

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function addToCart(data: {
  cartId?: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}): Cart {
  // ... typed implementation
}
```

## Decisions
- Use `.js` extension in import paths because we will later switch to ESM (`"type": "module"`) and `tsc` emits `.js`.
- Keep `Date` objects instead of ISO strings — easier to do TTL math later.

## Risks
- No compile-time checks on HTTP payloads yet.
