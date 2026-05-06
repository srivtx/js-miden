# MD02: Time Range Overlap Algorithms

## The Canonical Overlap Condition

The single most important query in a booking system is detecting whether two time ranges overlap. The condition is:

```
Range A: [startA, endA)
Range B: [startB, endB)

A and B overlap if and only if:
    startA < endB AND endA > startB
```

In SQL:

```sql
SELECT * FROM bookings
WHERE resource_id = 'room-101'
  AND status IN ('confirmed', 'hold')
  AND start_time < '2024-06-01T14:00:00Z'   -- requested end
  AND end_time > '2024-06-01T10:00:00Z';    -- requested start
```

## Why This Formula?

Consider the four ways two ranges can be positioned:

```
Case 1: A completely before B (no overlap)
  A: |-----|
  B:           |-----|
  startA < endB? YES (10 < 20)
  endA > startB? NO  (15 > 20 is FALSE)
  Result: NO overlap ✓

Case 2: A completely after B (no overlap)
  A:           |-----|
  B: |-----|
  startA < endB? NO  (20 < 15 is FALSE)
  endA > startB? YES (25 > 10)
  Result: NO overlap ✓

Case 3: A overlaps B (overlap!)
  A: |-----|
  B:      |-----|
  startA < endB? YES (10 < 20)
  endA > startB? YES (15 > 12)
  Result: OVERLAP ✓

Case 4: A contains B (overlap!)
  A: |-----------|
  B:    |-----|
  startA < endB? YES (10 < 18)
  endA > startB? YES (20 > 12)
  Result: OVERLAP ✓
```

The negation ("do NOT overlap") is easier to reason about:

> Two ranges do NOT overlap if `endA <= startB` OR `endB <= startA`.

Therefore, they DO overlap if:
> `NOT (endA <= startB OR endB <= startA)`
> which simplifies to:
> `endA > startB AND endB > startA`

Rearranging (swapping sides):
> `startA < endB AND endA > startB`

## SQL Transaction Example: Atomic Booking Check

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- 1. Check for overlap with EXCLUSIVE lock
SELECT * FROM bookings
WHERE resource_id = 'room-101'
  AND status IN ('confirmed', 'hold')
  AND start_time < '2024-06-01T14:00:00Z'
  AND end_time > '2024-06-01T10:00:00Z'
FOR UPDATE;

-- 2. If no rows returned, slot is free. Book it.
INSERT INTO bookings (resource_id, user_id, start_time, end_time, status)
VALUES ('room-101', 'user-789', '2024-06-01T10:00:00Z', '2024-06-01T14:00:00Z', 'hold');

COMMIT;
```

`FOR UPDATE` ensures that if another transaction is concurrently trying to book the same slot, one of them will wait or fail.

## PostgreSQL Exclusion Constraints

PostgreSQL has a powerful feature for this exact problem: **Exclusion Constraints** using the `btree_gist` extension.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20),

    -- The magic: prevent ANY overlapping ranges for the same resource
    CONSTRAINT no_overlap EXCLUDE USING gist (
        resource_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    )
    WHERE (status IN ('confirmed', 'hold'))
);
```

This constraint:
- Uses GiST (Generalized Search Tree) index
- Defines: "No two rows can have the same `resource_id` AND overlapping time ranges"
- The `WHERE` clause makes it conditional on status

If two transactions try to insert overlapping rows, the second gets:
```
ERROR: conflicting key value violates exclusion constraint "no_overlap"
```

This pushes the correctness check into the database engine, eliminating application-level race conditions.

## Performance: Why the Index Matters

Without an index, the overlap query is a **sequential scan**:

```sql
EXPLAIN SELECT * FROM bookings
WHERE resource_id = 'room-101'
  AND start_time < '2024-06-01T14:00:00Z'
  AND end_time > '2024-06-01T10:00:00Z';

-- Without index: Seq Scan on bookings (cost=0.00..10000.00)
```

With a B-tree on `(resource_id, start_time, end_time)`:

```sql
CREATE INDEX idx_bookings_overlap ON bookings (resource_id, start_time, end_time);

-- With index: Index Scan (cost=0.42..8.44)
```

PostgreSQL can use the index to:
1. Jump to `resource_id = 'room-101'`
2. Within that, skip to `start_time < end_of_query_range`
3. Check the `end_time > start_of_query_range` condition on the remaining candidates

## Alternative: Temporal Tables (SQL:2011)

Some databases (notably Oracle, SQL Server, MariaDB) support **temporal features**:

```sql
-- SQL:2011 standard (not fully supported in PostgreSQL as of 2024)
CREATE TABLE bookings (
    resource_id UUID,
    booking_period PERIOD FOR (start_time, end_time),
    CONSTRAINT no_overlap PRIMARY KEY (resource_id, booking_period WITHOUT OVERLAPS)
);
```

PostgreSQL achieves the same via Exclusion Constraints, as shown above.

## Edge Case: Zero-Duration Bookings

A booking with `start_time == end_time` is a point in time. Does it overlap with another booking?

Mathematically, a point `[t, t)` has zero measure and does not overlap with any range. However, business rules may differ:
- Hotel check-out at 11:00 and check-in at 11:00: these should NOT overlap.
- Doctor appointments: back-to-back is fine.

Our formula `startA < endB AND endA > startB` correctly handles this:
- `[10, 10)` vs `[10, 11)`: `10 < 11` (true) AND `10 > 10` (false) → NO overlap ✓

## Key Insight

> "The overlap query is to booking systems what the JOIN is to relational databases: fundamental, unavoidable, and performance-critical."

Mastering this query — and the database features that optimize it — separates robust booking systems from those that double-book under load.
