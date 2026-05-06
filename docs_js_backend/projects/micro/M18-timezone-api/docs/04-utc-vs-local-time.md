# UTC vs Local Time

## WHAT

- **UTC (Coordinated Universal Time):** A continuous, monotonic atomic timescale with no DST. The universal reference for software systems.
- **Local Time:** A political construct defined by timezone legislation. It includes offsets, DST rules, and historical changes.

**Analogy:** UTC is the GPS coordinate; local time is the street address. Addresses change; coordinates do not.

## WHY

Mixing UTC and local time causes silent data corruption:

- A server in `America/New_York` records `2024-01-15 09:00:00` locally. A client in `Asia/Tokyo` sees it as `2024-01-15 09:00:00` in their own zone — an 8-hour error.
- Logs without UTC offsets cannot be correlated across distributed systems.
- Database `TIMESTAMP WITHOUT TIME ZONE` columns are footguns: PostgreSQL stores the value verbatim, assuming the session timezone.

## HOW

**Server-side rule:**

1. Generate all timestamps in UTC.
2. Store all timestamps in UTC.
3. Convert to local time only at the presentation layer (client or API response formatting).

```javascript
// Server: store UTC
const createdAt = new Date().toISOString(); // "2024-06-15T14:00:00.000Z"

// Client: convert to local
const local = new Date(createdAt).toLocaleString("de-DE", {
  timeZone: "Europe/Berlin"
});
```

**Database best practice:**

- PostgreSQL: Use `TIMESTAMPTZ` (timestamp with time zone). It stores UTC internally.
- MySQL: Use `DATETIME` with UTC values, or `TIMESTAMP` (stores UTC).
- Never use `DATETIME` / `TIMESTAMP WITHOUT TIME ZONE` for cross-zone data.

## WRONG vs RIGHT

### WRONG: Store Local Time Without Zone

```javascript
// BAD: Ambiguous; depends on server location and DST
const now = new Date();
await db.todo.create({
  data: { title: "Task", dueDate: now.toString() } // "Sun Jun 15 2024 10:00:00 GMT-0400"
});
```

### RIGHT: Store UTC + Zone Name

```javascript
// GOOD: Unambiguous instant + presentation zone
const now = new Date().toISOString(); // UTC
await db.todo.create({
  data: { title: "Task", dueDate: now, timeZone: "America/New_York" }
});

// For display:
const display = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  dateStyle: "full", timeStyle: "long"
}).format(new Date(todo.dueDate));
```

## Breach Story: F-22 Raptor Avionics (2007)

In February 2007, a squadron of F-22 Raptors crossing the International Date Line experienced total avionics failure — navigation, communication, and fuel systems crashed. The root cause was a time calculation bug in the jet's software that failed when the date changed abruptly. While not strictly a UTC/local bug, it underscores the catastrophic risk of treating time as a simple integer without boundary analysis.

## References

- ITU-R TF.460-6: Standard-frequency and time-signal emissions.
- RFC 3339: Date and Time on the Internet.
- PostgreSQL Docs: 8.5. Date/Time Types — https://www.postgresql.org/docs/current/datatype-datetime.html
