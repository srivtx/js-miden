# MD16 Food Delivery — v2 Add TypeScript

## Goal
Eliminate runtime type errors by introducing TypeScript interfaces and strict checking.

## Changes from v1
- Rename `.js` → `.ts`
- Add `tsconfig.json` with `strict: true`
- Introduce interfaces for Order, Driver, Restaurant
- Add `@types/express`, `tsx` for dev

## New Interfaces

### `src/types/index.ts`
```typescript
export interface OrderInput {
  customerId: string;
  restaurantId: string;
  items: { menuId: string; quantity: number }[];
  address: string;
  latitude: number;
  longitude: number;
}

export interface DriverInput {
  userId: string;
}

export interface LocationInput {
  latitude: number;
  longitude: number;
}
```

## Updated Service

### `src/services/orderService.ts`
```typescript
import { db } from '../db.js'; // still SQLite in v2
import type { OrderInput } from '../types/index.js';

export class OrderService {
  async createOrder(data: OrderInput): Promise<{ id: number }> {
    // TypeScript now catches missing fields at compile time
    const { customerId, restaurantId, address } = data;
    // ...
  }
}
```

## Benefits
- `data.items.map(...)` fails compile if `items` is missing
- Refactoring restaurant fields is now safe across the codebase
- IDE autocomplete works in VS Code

## Still Missing
- Validation still manual (`if (!data.customerId) throw ...`)
- No automated tests
- SQLite still file-based, no concurrency guarantees
