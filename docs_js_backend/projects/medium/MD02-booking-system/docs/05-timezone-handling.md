# MD02: Timezone Handling

## The Complexity of Time

Timezones are the most common source of bugs in calendar systems. Consider this scenario:

> A user in Los Angeles books a room for 9:00 AM - 10:00 AM on June 1st. Another user in New York views the calendar. What time do they see?

The answer depends on whether the booking is anchored to:
1. **The resource's timezone** (the room is in LA, so it's always 9:00 AM LA time)
2. **The user's timezone** (the LA user booked 9:00 AM their time, but if they move to NY...)
3. **UTC** (stored as 16:00 UTC, displayed in local time)

## The Golden Rule

> **Store in UTC. Display in local. Never trust the client's timezone alone.**

```sql
-- Storage (always UTC)
INSERT INTO bookings (start_time, end_time, local_timezone)
VALUES ('2024-06-01T16:00:00Z', '2024-06-01T17:00:00Z', 'America/Los_Angeles');

-- Display: convert to user's timezone in application layer
const startLocal = moment.utc(booking.start_time)
    .tz(booking.local_timezone)
    .format('YYYY-MM-DD h:mm A'); // "2024-06-01 9:00 AM"
```

## The IANA Timezone Database

Use the **IANA Olson database** (e.g., `America/Los_Angeles`, not `PST`). Why?
- `PST` is ambiguous (Pacific Standard Time vs. Pakistan Standard Time)
- Daylight Saving Time transitions are handled automatically by IANA zones

PostgreSQL supports IANA zones natively:
```sql
SELECT '2024-06-01T16:00:00Z'::timestamptz AT TIME ZONE 'America/Los_Angeles';
-- Result: 2024-06-01 09:00:00 (as TIMESTAMP, no zone)
```

## Daylight Saving Time (DST) Traps

### The "Spring Forward" Gap

In most of the US, clocks jump from 1:59 AM to 3:00 AM on the second Sunday in March.

```
Time in America/Los_Angeles:
  1:30 AM ──► 1:59 AM ──► 3:00 AM
                   ↑_____↓
                   Missing hour!
```

If a user tries to book 2:30 AM - 3:30 AM on that day, the time **does not exist**. The system must reject or adjust.

```sql
-- Attempting to book a non-existent time
SELECT '2024-03-10T02:30:00'::timestamptz AT TIME ZONE 'America/Los_Angeles';
-- Result: ERROR or unexpected behavior depending on DB
```

**Solution**: Validate that the requested local time converts to exactly one UTC instant.

```javascript
function validateLocalTime(localTime, timezone) {
    const utc = moment.tz(localTime, 'YYYY-MM-DD HH:mm', timezone).utc();
    // Check if the moment is valid and not ambiguous
    if (!utc.isValid()) {
        throw new Error('Invalid time (may not exist due to DST)');
    }
    return utc.toISOString();
}
```

### The "Fall Back" Overlap

Clocks jump from 1:59 AM back to 1:00 AM on the first Sunday in November.

```
Time in America/Los_Angeles:
  1:00 AM ──► 1:30 AM ──► 1:59 AM ──► 1:00 AM ──► 1:30 AM
                               ↑______________↓
                               Hour repeats!
```

1:30 AM occurs **twice**. Which UTC instant does it refer to?
- Before the jump (PDT, UTC-7)
- After the jump (PST, UTC-8)

**Solution**: Disambiguate with the UTC offset or let the user choose.

```sql
-- PostgreSQL accepts offset to disambiguate
SELECT '2024-11-03T01:30:00-07:00'::timestamptz; -- Before jump
SELECT '2024-11-03T01:30:00-08:00'::timestamptz; -- After jump
```

## Recurring Bookings Across DST

A recurring booking at 9:00 AM local time must stay at 9:00 AM local time, even when DST changes.

```sql
-- BAD: Store as fixed UTC
-- 9:00 AM LA = 17:00 UTC in winter, 16:00 UTC in summer
-- Storing 17:00 UTC year-round means summer bookings show as 10:00 AM LA!

-- GOOD: Store local time and timezone
-- start_time_local = '09:00', timezone = 'America/Los_Angeles'
-- Convert to UTC on each occurrence based on the date
```

This is why **RFC 5545 (iCalendar)** stores local times for recurring events and applies timezone rules at expansion time.

## Cross-Timezone Collaboration

When a resource and a user are in different timezones:

```
Resource: Conference Room A (Berlin, Europe/Berlin)
User:     Remote participant (Tokyo, Asia/Tokyo)

Booking:  2024-06-01 14:00-15:00 Berlin time

Display to user in Tokyo:
  2024-06-01 21:00-22:00 Tokyo time
```

The system must display **both** times to avoid confusion:

```javascript
const display = {
    resourceLocal: 'June 1, 2:00 PM - 3:00 PM (CEST)',
    userLocal: 'June 1, 9:00 PM - 10:00 PM (JST)',
    utc: 'June 1, 12:00 PM - 1:00 PM UTC'
};
```

## Timeline: Timezone Bug in Production

```
Bug Report: "My 9 AM meeting moved to 8 AM!"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Root Cause: Developer stored recurring meeting in UTC fixed offset.

Before DST (March):
  Stored: 17:00 UTC
  Displayed in LA: 9:00 AM PDT (UTC-7) ✓

After DST starts (April):
  Stored: 17:00 UTC
  Displayed in LA: 10:00 AM PDT (UTC-7) ✗

User expected 9:00 AM. System showed 10:00 AM. User rescheduled
thinking it was wrong. After fall back, it showed 9:00 AM again.

Fix: Store local time + timezone rule. Compute UTC dynamically.
```

## Best Practices Summary

1. **Database**: Use `TIMESTAMPTZ` (UTC internally) for absolute instants.
2. **Application**: Use `moment-timezone`, `date-fns-tz`, or `Luxon` for conversions.
3. **API**: Accept ISO 8601 with offset (e.g., `2024-06-01T09:00:00-07:00`).
4. **Display**: Always show the timezone abbreviation (PDT, PST, CEST).
5. **Validation**: Reject ambiguous local times during DST transitions.
6. **Recurring**: Store local wall-clock time, not fixed UTC.

## Reference

- **RFC 5545**: "Internet Calendaring and Scheduling Core Object Specification (iCalendar)".
- **IANA Time Zone Database**: https://www.iana.org/time-zones
- **Martin Fowler**, "It's About Time". Blog post on timezone handling in domain models.
