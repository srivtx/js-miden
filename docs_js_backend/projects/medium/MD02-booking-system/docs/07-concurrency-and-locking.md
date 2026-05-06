# MD02: Concurrency and Locking in Bookings

## The Booking Concurrency Problem

A booking system is a classic **contention hotspot**: many users compete for a small number of high-value slots. Without proper concurrency control, double-bookings are inevitable.

## Types of Booking Conflicts

### Conflict 1: Double Booking (Same Slot)

```
User A and User B both try to book Room 101, June 1, 10:00-12:00.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Time │ User A                        │ User B
─────┼───────────────────────────────┼──────────────────────────────
 T0  │ BEGIN;                        │
 T1  │ SELECT * FROM bookings        │ BEGIN;
 T2  │ WHERE resource_id='room-101'  │ SELECT * FROM bookings
 T3  │ AND ... overlap check         │ WHERE resource_id='room-101'
 T4  │ → No rows found               │ AND ... overlap check
 T5  │                               │ → No rows found
 T6  │ INSERT booking (hold)         │
 T7  │ COMMIT                        │
 T8  │                               │ INSERT booking (hold)
 T9  │                               │ COMMIT
─────┴───────────────────────────────┴──────────────────────────────
Result: TWO overlapping holds for the same room. Double-booked!
```

This is a **phantom read** under `READ COMMITTED` isolation. Even though each user's `SELECT` sees no rows, the inserts conflict.

## Solution 1: Pessimistic Locking (FOR UPDATE)

Lock the resource row itself, or use a dedicated lock table:

```sql
BEGIN;

-- Acquire an advisory lock on the resource (PostgreSQL-specific)
SELECT pg_advisory_xact_lock(hashtext('room-101'));

-- Now check availability
SELECT * FROM bookings
WHERE resource_id = 'room-101'
  AND status IN ('hold', 'confirmed')
  AND start_time < '2024-06-01T12:00:00Z'
  AND end_time > '2024-06-01T10:00:00Z';

-- If no rows, insert
INSERT INTO bookings ...;

COMMIT; -- Lock automatically released
```

`pg_advisory_xact_lock` is tied to the transaction. It is released on `COMMIT` or `ROLLBACK`.

## Solution 2: Exclusion Constraints (Database-Enforced)

As shown in `03-overlap-algorithms.md`:

```sql
ALTER TABLE bookings ADD CONSTRAINT no_overlap EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
)
WHERE (status IN ('hold', 'confirmed'));
```

If two transactions try to insert overlapping rows, the second fails with:
```
ERROR: conflicting key value violates exclusion constraint "no_overlap"
```

This is the **strongest guarantee** because the database enforces it, not the application.

## Solution 3: Optimistic Locking (Versioning)

For operations that don't naturally insert (e.g., modifying a booking), use versioning:

```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY,
    ...,
    version INT NOT NULL DEFAULT 1
);

-- Update only if version matches
UPDATE bookings
SET status = 'cancelled', version = version + 1
WHERE id = 'booking-123' AND version = 5;

-- Check rowCount. If 0, another transaction modified it first.
```

## Solution 4: Distributed Locking (Redis Redlock)

For multi-node application servers, in-database locking may not be sufficient if the overlap check spans multiple queries:

```javascript
const { Redlock } = require('redlock');

const redlock = new Redlock([redis]);

async function bookSlot(resourceId, start, end) {
    const lock = await redlock.acquire([`locks:resource:${resourceId}`], 5000);
    try {
        // Overlap check + insert
        await db.transaction(async (trx) => {
            const conflicts = await trx.query(...overlap check...);
            if (conflicts.length === 0) {
                await trx.query(...insert booking...);
            }
        });
    } finally {
        await lock.release();
    }
}
```

Caveat: **Redlock is controversial**. Martin Kleppmann argues it is not safe under all clock skew conditions ("How to do distributed locking", 2016). For booking systems, in-database exclusion constraints are preferred.

## Lock Hierarchy and Deadlock Prevention

When multiple resources are booked simultaneously (e.g., a package: room + car + flight), acquire locks in a consistent order:

```javascript
const resources = [roomId, carId, flightId].sort();
// Always lock in lexicographic order to prevent circular waits
```

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('resource-a'));
SELECT pg_advisory_xact_lock(hashtext('resource-b'));
SELECT pg_advisory_xact_lock(hashtext('resource-c'));
-- ... booking logic ...
COMMIT;
```

## Read Committed vs. Serializable for Bookings

| Scenario | Isolation | Rationale |
|----------|-----------|-----------|
| Simple availability check | `READ COMMITTED` + Exclusion Constraint | Fast, constraint handles conflict |
| Complex multi-resource package | `SERIALIZABLE` | Ensures global consistency |
| Reporting queries | `READ COMMITTED` | No need for strict isolation |
| Admin modifying bookings | `REPEATABLE READ` | Prevent lost updates |

## Timeline: Deadlock in Multi-Resource Booking

```
Package Booking: Room 101 + Car A
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Time │ User A (Room 101 + Car A)    │ User B (Car A + Room 101)
─────┼──────────────────────────────┼──────────────────────────────
 T0  │ Lock Room 101                │
 T1  │                              │ Lock Car A
 T2  │ Try Lock Car A → WAITS       │
 T3  │                              │ Try Lock Room 101 → WAITS
 T4  │ DEADLOCK!                    │ DEADLOCK!
─────┴──────────────────────────────┴──────────────────────────────
Fix: Always acquire locks in sorted order (Car A, then Room 101).
```

## Monitoring Concurrency

```sql
-- PostgreSQL: Current locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Lock wait time
SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';

-- Deadlock frequency
SELECT deadlocks FROM pg_stat_database WHERE datname = 'booking_db';
```

## Key Insight

> "Booking concurrency is not a locking problem. It is a **conflict detection** problem. The best systems detect conflicts at the database level (constraints) rather than relying on application-level locking." — Database Internals, Alex Petrov

Exclusion constraints are the "pit of success" for booking systems. They make incorrect states **unrepresentable**.
