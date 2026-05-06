# DST Transitions

## WHAT

Daylight Saving Time (DST) transitions create two classes of problems:

1. **Spring Forward (Gap):** The clock jumps ahead. Local times in the gap do not exist.
2. **Fall Back (Overlap):** The clock jumps back. Local times in the overlap occur twice.

Example: In `America/New_York`, 2024 spring forward occurs at 2:00 AM → 3:00 AM on 10 March. The local time `02:30` does not exist.

## WHY

Scheduling systems that ignore gaps and overlaps produce:

- **Phantom meetings:** A calendar event at 2:30 AM on spring-forward day may be silently shifted or rejected.
- **Duplicate logs:** A log entry at 1:30 AM on fall-back day is ambiguous without a disambiguator.
- **Billing errors:** Hourly billing systems may bill 23 or 25 hours per day.

## HOW

**Strategy: Store unambiguous instants (UTC), convert to local only for display.**

When you must accept local input, use a library that exposes gap/overlap behavior:

```javascript
const { DateTime } = require("luxon");

// Spring forward gap
const gap = DateTime.local(2024, 3, 10, 2, 30, { zone: "America/New_York" });
console.log(gap.isValid); // false — invalid because it does not exist

// Fall back overlap
const overlap = DateTime.local(2024, 11, 3, 1, 30, { zone: "America/New_York" });
console.log(overlap.offset); // -4 (EDT) or -5 (EST) depending on disambiguation
// Luxon defaults to the earlier offset (EDT)
```

**API contract for ambiguous local times:**

- Reject invalid local times (return `400 Bad Request`).
- Or define a rule: "use the later offset" or "use the earlier offset."
- Document the behavior explicitly.

## WRONG vs RIGHT

### WRONG: Naive Local Time Assumption

```javascript
// BAD: Assumes every local time exists and maps 1:1 to UTC
function scheduleEvent(localTime, zone) {
  const d = new Date(`${localTime} ${zone}`); // Naive parse
  return d.toISOString(); // May be off by an hour or NaN
}
```

### RIGHT: Explicit Gap/Overlap Handling

```javascript
// GOOD: Validates local time and handles ambiguity
const { DateTime } = require("luxon");

function scheduleEvent(localIso, zone) {
  const dt = DateTime.fromISO(localIso, { zone });
  if (!dt.isValid) {
    throw new Error("Local time does not exist (gap) or is invalid.");
  }
  return dt.toUTC().toISO(); // Unambiguous instant
}
```

## Timeline: Spring-Forward Gap

```
Local clock (America/New_York)
│
01:59:58 ── 01:59:59 ── 02:00:00 ── ??? ── 03:00:00 ── 03:00:01
                              ↑        ↑
                         Clock jumps   02:30 does not exist
                         to 03:00

UTC clock (continuous)
│
06:59:58 ── 06:59:59 ── 07:00:00 ── 07:00:01 ── 07:30:00 ── 08:00:00
```

## Breach Story: Azure AD B2C (2019)

In October 2019, European users of Azure AD B2C experienced authentication failures during the DST transition. The service miscalculated token expiry windows when local time shifted back, causing tokens to be prematurely invalidated or accepted past their true UTC expiry. Microsoft later patched the underlying time arithmetic to use UTC exclusively for all internal token lifetimes.

## References

- IANA Time Zone Database: https://www.iana.org/time-zones
- Luxon Documentation: https://moment.github.io/luxon/
- Eggert, P. (2023). * tzdb commentary files (asia, europe, northamerica)*.
