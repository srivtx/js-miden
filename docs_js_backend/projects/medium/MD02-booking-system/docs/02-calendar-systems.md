# MD02: Calendar Systems and Recurrence

## The Calendar as a Data Structure

A calendar is not merely a list of events. It is a **temporal index** over a resource. Efficient calendar systems must answer:
- "Is this slot free?"
- "What are the free slots between A and B?"
- "What is the full schedule for March?"

## Time Representation

### Absolute Time (TIMESTAMPTZ)

PostgreSQL's `TIMESTAMPTZ` stores instants in UTC internally, displaying in the session timezone. This is **mandatory** for booking systems.

```sql
-- Never use TIMESTAMP (without timezone) for bookings
-- BAD:  CREATE TABLE bookings (start_time TIMESTAMP);
-- GOOD: CREATE TABLE bookings (start_time TIMESTAMPTZ);
```

Why? `TIMESTAMP` is a "wall clock" time. It represents "9:00 AM" without knowing *where*. If a user in Tokyo books 9:00 AM, and you store it as `TIMESTAMP`, you lose the fact that it was Tokyo time.

### Storing Local Time Separately

For display and business rules, store the intended local time:

```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY,
    resource_id UUID REFERENCES resources(id),
    start_time TIMESTAMPTZ NOT NULL,      -- Absolute instant (UTC)
    end_time TIMESTAMPTZ NOT NULL,
    local_start_time TIMESTAMP NOT NULL,   -- Wall clock time (for display)
    local_end_time TIMESTAMP NOT NULL,
    local_timezone VARCHAR(50) NOT NULL,   -- 'Asia/Tokyo', 'America/New_York'
    CHECK (start_time < end_time)
);
```

This allows you to answer: "Show me all bookings that start at 9:00 AM local time, regardless of timezone."

## Calendar Query Patterns

### 1. Get Schedule for a Resource (Range Query)

```sql
SELECT * FROM bookings
WHERE resource_id = 'room-101'
  AND start_time >= '2024-06-01T00:00:00Z'
  AND start_time < '2024-07-01T00:00:00Z'
ORDER BY start_time;
```

### 2. Find Free Slots (Gap Analysis)

This is one of the hardest calendar queries. Given a resource and a date range, find all contiguous free blocks of at least `min_duration`.

```sql
WITH booked_ranges AS (
    SELECT start_time, end_time
    FROM bookings
    WHERE resource_id = 'room-101'
      AND status IN ('confirmed', 'hold')
      AND end_time > '2024-06-01T00:00:00Z'
      AND start_time < '2024-06-02T00:00:00Z'
    ORDER BY start_time
),
gaps AS (
    SELECT
        LAG(end_time) OVER (ORDER BY start_time) AS gap_start,
        start_time AS gap_end
    FROM booked_ranges
)
SELECT gap_start, gap_end
FROM gaps
WHERE gap_start IS NOT NULL
  AND gap_end - gap_start >= INTERVAL '1 hour';
```

### 3. Check Single Slot Availability

```sql
SELECT NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE resource_id = 'room-101'
      AND status IN ('confirmed', 'hold')
      AND start_time < '2024-06-01T14:00:00Z'
      AND end_time > '2024-06-01T10:00:00Z'
) AS is_available;
```

## Recurring Bookings

Recurring events ("every Monday at 10 AM") are challenging because they conceptually represent an **infinite series**. Storing every instance is infeasible.

### Pattern 1: Store the Recurrence Rule (RRULE)

Inspired by **iCalendar (RFC 5545)**:

```sql
CREATE TABLE recurring_bookings (
    id UUID PRIMARY KEY,
    resource_id UUID REFERENCES resources(id),
    start_time TIMESTAMPTZ NOT NULL,       -- First occurrence
    duration INTERVAL NOT NULL,
    rrule VARCHAR(255),                    -- "FREQ=WEEKLY;BYDAY=MO;UNTIL=20241231"
    exdates TIMESTAMPTZ[]                  -- Explicitly excluded dates
);
```

The RRULE is parsed and expanded on read. This is how Google Calendar works.

### Pattern 2: Materialized Instances

Pre-compute occurrences into the main `bookings` table:

```sql
-- When creating a recurring booking, insert N instances
INSERT INTO bookings (resource_id, start_time, end_time, status, recurrence_group_id)
SELECT
    'room-101',
    generate_series(
        '2024-01-01T10:00:00Z'::timestamptz,
        '2024-12-31T10:00:00Z'::timestamptz,
        '7 days'::interval
    ) AS start_time,
    generate_series(
        '2024-01-01T10:00:00Z'::timestamptz,
        '2024-12-31T10:00:00Z'::timestamptz,
        '7 days'::interval
    ) + INTERVAL '1 hour' AS end_time,
    'confirmed',
    'rec-group-abc'
FROM generate_series(1,1); -- dummy
```

Pros: Queries are simple (just hit the bookings table).
Cons: Editing the recurrence requires updating many rows. Deleting the series requires a group delete.

### Recommendation

For medium-scale systems, **store the RRULE** and expand on demand for the queried window. Cache expanded results in Redis with a TTL.

```javascript
// Pseudo-expansion logic
function expandOccurrences(rrule, startWindow, endWindow) {
    const occurrences = [];
    let current = rrule.start;
    while (current <= rrule.until && current <= endWindow) {
        if (current >= startWindow && !exdates.includes(current)) {
            occurrences.push({
                start: current,
                end: current + rrule.duration
            });
        }
        current = addInterval(current, rrule.frequency);
    }
    return occurrences;
}
```

## Indexing Strategy

```sql
-- Essential: overlap query support
CREATE INDEX idx_bookings_resource_time
ON bookings (resource_id, start_time, end_time)
WHERE status IN ('confirmed', 'hold');

-- For user-centric queries
CREATE INDEX idx_bookings_user_time
ON bookings (user_id, start_time);

-- For finding expired holds
CREATE INDEX idx_bookings_hold_expires
ON bookings (hold_expires_at)
WHERE status = 'hold';
```

The partial index (`WHERE status IN ('confirmed', 'hold')`) is crucial. Cancelled bookings should not participate in overlap checks, and excluding them keeps the index small and fast.

## Key Insight

> "A calendar is a two-dimensional spatial index where one dimension is time and the other is resource." — Adapted from "Managing Time in Relational Databases" by Tom Johnston and Randall Weis.

Efficient calendar systems require **range indexes** (B-trees on `(start, end)`) and **careful exclusion of irrelevant states** (cancelled, deleted) from the active index.
