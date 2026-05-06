# 02-architecture.md

## Components

- **Express Router** (`routes.ts`) — cart CRUD and merge endpoints
- **Cart Service** (`service.ts`) — cart creation, item management, merge logic
- **In-Memory Map** — cart storage keyed by cart ID

## Data Flow

1. Client adds item without cartId
2. Service generates new cart ID
3. **BUG:** Sequential counter makes IDs predictable (`cart-1`, `cart-2`)
4. Cart stored in Map with items and calculated total
5. `POST /cart/merge` combines guest and user carts

## Design Decisions

- In-memory Map simulates Redis for local development
- Cart totals recalculated on every mutation
- Merge preserves user cart and deletes guest cart
