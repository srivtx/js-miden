# 02-architecture.md

## Components

- **Express Router** (`routes.ts`) — wishlist CRUD endpoints
- **Wishlist Service** (`service.ts`) — item management, price tracking
- **In-Memory Store** — shared array of wishlist items

## Data Flow

1. Client adds item via `POST /wishlist`
2. Service appends to shared array
3. **BUG:** No deduplication check — same item added multiple times
4. `GET /wishlist/:userId` returns all items
5. **BUG:** No user filtering — returns every user's items

## Design Decisions

- Shared array simplifies state but introduces isolation bugs
- Price history tracked in a separate Map
- Price changes computed by comparing current vs historical prices
