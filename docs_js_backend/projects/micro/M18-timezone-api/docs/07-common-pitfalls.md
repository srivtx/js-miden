# Common Pitfalls

## WHAT

Timezone APIs appear simple but hide a class of bugs that are silent, rare, and catastrophic. This document catalogs the most common mistakes.

## Pitfall 1: Storing Local Time Without Zone

**WRONG:**
```javascript
const due = new Date().toString(); // "Sun Jun 15 2024 10:00:00 GMT-0400"
await db.event.create({ data: { dueDate: due } });
```

**RIGHT:**
```javascript
const due = new Date().toISOString(); // "2024-06-15T14:00:00.000Z"
await db.event.create({ data: { dueDate: due, timeZone: "America/New_York" } });
```

## Pitfall 2: Hardcoding Offsets

**WRONG:**
```javascript
const toTokyo = (utc) => new Date(utc.getTime() + 9 * 3600 * 1000);
// Fails during DST transitions and rule changes
```

**RIGHT:**
```javascript
const toTokyo = (iso) => new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", dateStyle: "full", timeStyle: "long"
}).format(new Date(iso));
```

## Pitfall 3: Parsing Ambiguous Strings

**WRONG:**
```javascript
new Date("03/10/2024 02:30"); // DST gap; result varies by engine
```

**RIGHT:**
```javascript
const { DateTime } = require("luxon");
DateTime.fromISO("2024-03-10T02:30:00", { zone: "America/New_York" });
// → invalid because time does not exist
```

## Pitfall 4: Using Client Clock for Server Logic

**WRONG:**
```javascript
// Client sends local timestamp; server trusts it
const createdAt = req.body.localTimestamp;
```

**RIGHT:**
```javascript
// Server generates UTC; client converts for display
const createdAt = new Date().toISOString();
```

## Pitfall 5: Ignoring tzdb Updates

**WRONG:**
```javascript
// Using an OS image from 2020 in 2024
// Chile, Turkey, Russia may have shifted rules
```

**RIGHT:**
```javascript
// Keep Node.js and tzdata updated
// Use libraries that bundle recent tzdb (luxon, date-fns-tz)
```

## Timeline: DST Scheduling Race Condition

```
Time ─────────────────────────────────────────────────>

User A (NY): ──[Create event at 02:30 AM, Mar 10]──────→
                    │
Server (UTC):    Parses as 07:30 UTC (assumes standard time)
                    │
User B (Berlin): ──[Views event at 08:30 CET]───────────→
                    │
Reality:        02:30 AM does not exist on Mar 10 in NY.
                Event is silently shifted or rejected.

Mitigation:
  - Reject invalid local times.
  - Store UTC + zone; convert only for display.
```

## References

- IANA Time Zone Database
- Luxon Documentation
- ECMA-262 Date.parse specification
