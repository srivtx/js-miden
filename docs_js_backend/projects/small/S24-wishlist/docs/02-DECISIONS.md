# 02-DECISIONS.md

## Decision 1: Storage Model

**Chosen:** Shared in-memory array `WishlistItem[]`.

**Alternatives:**
- **Map per user**: `Map<string, WishlistItem[]>` provides natural isolation but still allows duplicates within a user.
- **PostgreSQL with composite unique**: Production standard. Enforces `(user_id, product_id)` uniqueness at the database level.
- **Redis Hash per user**: `HSET wishlist:user-1 prod-1 '{...}'`. Fast lookups, automatic user isolation.

**Why shared array:** Makes the isolation and deduplication bugs visible. Both bugs are fixed by changing the data structure.

---

## Decision 2: ID Generation

**Chosen:** `Math.random().toString(36).substring(2, 15)`.

**Alternatives:**
- **UUID v4**: Standard, collision-resistant. Better for production.
- **CUID**: Sortable, URL-safe. Good for client-visible IDs.
- **Database auto-increment**: Simple but leaks insertion order and count.

**Why random string:** Sufficient for a demo. The bugs demonstrated are unrelated to ID generation.

---

## Decision 3: Price Tracking

**Chosen:** Separate `priceHistory` Map with `updateProductPrice()` function.

**Alternatives:**
- **Store price in item record**: Simpler but loses historical price data.
- **External price API**: Real-time price fetching. Adds latency and failure modes.
- **Event stream**: Kafka/PubSub for price updates. Overkill for a demo.

**Why separate Map:** Demonstrates the concept of price change detection without external dependencies.

---

## Decision 4: Authorization Model

**Chosen:** No authorization (the bug). `userId` is passed as a URL parameter with no validation.

**Alternatives:**
- **JWT session**: Verify `sub` claim matches `userId` parameter.
- **OAuth2 scope**: Require `wishlist:read` scope.
- **API key per user**: Simple but harder to rotate.

**Why no auth:** Demonstrates the isolation bug clearly. Production would add middleware to validate the authenticated user.

---

## Decision 5: Language / Runtime

**Chosen:** TypeScript + Node.js.

**Alternatives:**
- **Python + FastAPI**: Excellent for rapid prototyping. Similar expressiveness.
- **Go**: Strong type safety, fast compilation. Good for high-throughput e-commerce.
- **Java + Spring**: Enterprise standard for retail systems.

**Why Node.js:** Express routing makes the endpoint bugs easy to see and fix.
