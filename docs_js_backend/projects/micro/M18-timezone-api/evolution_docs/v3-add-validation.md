# M18 Timezone API — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Your TypeScript timezone API accepts any string inputs:

```bash
# Invalid timezone — crashes server
curl http://localhost:3000/time/Invalid/Zone

# Missing parameters — confusing error
curl "http://localhost:3000/convert?from=UTC"

# Invalid time format — silent corruption
curl "http://localhost:3000/convert?from=UTC&to=Asia/Tokyo&time=tomorrow"

# Ambiguous time — no DST handling
curl "http://localhost:3000/convert?from=America/New_York&to=UTC&time=2024-11-03T01:30:00"
# Is this 1:30 AM EDT or EST? Both exist on that day!
```

Without validation:
- Invalid timezones throw unhandled `RangeError`
- Missing parameters produce `undefined` behavior
- Non-ISO time strings parse unpredictably
- DST transitions create ambiguous times

## The Fix: Strict Validation

```ts
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

export function isValidTimeZone(tz: string): boolean {
  return VALID_TIMEZONES.has(tz);
}

export function convertTime(fromZone: string, toZone: string, timeString: string) {
  // Validate ISO-like input
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/;
  if (!isoRegex.test(timeString)) {
    throw new Error('Time must be in ISO 8601 format');
  }

  const date = new Date(timeString);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid time value');
  }

  // ... conversion logic
}
```

**What validation prevents:**
- **Server crashes:** `isValidTimeZone` rejects invalid zones before `Intl` sees them
- **Missing params:** Explicit checks before processing
- **Bad formats:** ISO regex ensures predictable parsing
- **Invalid dates:** `isNaN(date.getTime())` catches edge cases like `2024-13-45`

## The Pain That Remains

A user reports: *"The API says Tokyo is +09:00, but my phone says +09:00. Why is the converted time wrong by an hour?"* You check your logs... you have none. You can't see what input they sent or what path the code took.

## What v4 Fixes

Logging. Debug timezone bugs without timezone math in your head.
