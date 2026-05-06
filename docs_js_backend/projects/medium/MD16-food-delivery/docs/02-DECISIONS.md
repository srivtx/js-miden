# Decisions & Alternatives

## Decision 1: Driver Assignment Strategy

**Chosen: Atomic updateMany with null check**

```typescript
const updatedOrder = await prisma.order.updateMany({
  where: { id: orderId, driverId: null },
  data: { driverId, status: 'PICKED_UP' },
});
if (updatedOrder.count === 0) throw new Error('Already assigned');
```

**Why:** Zero additional infrastructure. Works with single-node and horizontally-scaled setups (as long as all nodes share the same PostgreSQL).

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Pessimistic locking (SELECT FOR UPDATE) | Deadlock risk under high contention; blocks readers |
| Optimistic locking (version column) | Requires schema change; retry logic complicates code |
| Redis distributed lock | Adds Redis dependency; lock expiry edge cases |
| Queue-based sequential processing | Adds latency; requires message queue infrastructure |

**Trade-off:** Under extreme contention (100+ drivers hitting same order), updateMany retries may cause slight latency. Acceptable for Phase 1.

---

## Decision 2: Inventory Validation Approach

**Chosen: Check inventory at order creation time**

```typescript
if (menuItem.inventory < item.quantity) {
  throw new Error(`Item ${menuItem.name} is out of stock`);
}
```

**Why:** Prevents overselling at the source. Simple and correct for Phase 1.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Inventory reservation (hold for 10 min) | Requires TTL/cron; complex for Phase 1 |
| Eventual consistency (async sync) | Risk of overselling during sync window |
| Database CHECK constraint | Good safety net but doesn't give user-friendly error |

**Trade-off:** No reservation means item could sell out between "add to cart" and "checkout". Real platforms solve this with cart reservation.

---

## Decision 3: ETA Calculation Method

**Chosen: Haversine formula + assumed speed (30 km/h urban)**

**Why:** Fast (< 1ms), no external API dependency, works offline.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Google Maps Distance Matrix API | Cost ($5/1000 requests), latency (~200ms), rate limits |
| OSRM (Open Source Routing Machine) | Requires self-hosted service; adds infrastructure |
| ML-based ETA prediction | Requires historical data pipeline; overkill for Phase 1 |

**Trade-off:** ETA can be off by 30-50% in dense urban areas. Real platforms use hybrid approaches.

---

## Decision 4: Real-Time Tracking Transport

**Chosen: Socket.IO**

**Why:** Bidirectional, room-based channels per order, automatic reconnection.

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Server-Sent Events (SSE) | One-way only; harder to acknowledge location updates |
| Long polling | High server load; not truly real-time |
| WebRTC data channels | Overkill; requires P2P infrastructure |

**Trade-off:** Socket.IO requires sticky sessions or Redis adapter for horizontal scaling.

---

## Decision 5: Order Status State Machine

**Chosen: 6 states with valid transition matrix**

```
PLACED -> PREPARING -> READY -> PICKED_UP -> DELIVERED
   |                                    |
   +----> CANCELLED <-------------------+
```

**Why:** Explicit state machine prevents invalid transitions (e.g., PREPARING -> DELIVERED).

**Alternatives Considered:**

| Alternative | Why Rejected |
|-------------|--------------|
| Free-form status string | Prone to bugs; no compile-time safety |
| Event sourcing (event log) | Powerful but adds significant complexity |
| State machine library (XState) | Overkill for 6 states; adds bundle size |

**Trade-off:** Adding new states requires schema migration + code update.
