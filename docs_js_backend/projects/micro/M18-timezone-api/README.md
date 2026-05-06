# M18: Timezone API

A micro API for retrieving current time in any IANA timezone and converting times between timezones.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/time/:timezone` | Returns current time for the given IANA timezone |
| GET | `/convert` | Converts a specific time between two timezones |
| GET | `/health` | Health check |

## Request

```bash
# Current time in Tokyo
curl http://localhost:3000/time/Asia/Tokyo

# Convert 2024-06-15T14:00:00Z from UTC to America/New_York
curl "http://localhost:3000/convert?from=UTC&to=America/New_York&time=2024-06-15T14:00:00Z"
```

## Response

```json
{
  "timezone": "Asia/Tokyo",
  "currentTime": "2024-06-16T05:00:00.000+09:00",
  "offset": "+09:00",
  "isDST": false
}
```

## Thinking Framework

### PHASE 1: Basic Time Endpoints
- Accept IANA timezone identifier (e.g., `America/New_York`)
- Use `Intl.DateTimeFormat` or native `Date` with `toLocaleString`
- Return ISO 8601 formatted string with offset

### PHASE 2: Production Hardening
- **IANA Database**: Node.js relies on the OS ICU/IANA database. Timezones can become invalid after OS updates. Validate against `Intl.supportedValuesOf('timeZone')` or a known list.
- **DST Transitions**: During "fall back" (duplicate hour) and "spring forward" (missing hour), naive conversion is ambiguous. Use `Date` objects internally (UTC epoch) rather than local wall-clock arithmetic.
- **Invalid Timezone Handling**: Return a clear 400 error for unknown zones. Do not crash or default silently.
- **ISO 8601 Formatting**: Always return ISO 8601 with offset (e.g., `2024-06-15T10:00:00-04:00`). Avoid locale-specific strings in APIs.
- **Parsing Input Times**: Reject non-ISO strings. Do not use `new Date(string)` for arbitrary user input without validation.

### PHASE 3: Security & Edge Cases
- **Ambiguous Times**: During DST fall-back, the same local time occurs twice. Accept a `dst` flag or document that the first occurrence is assumed.
- **Missing Times**: During DST spring-forward, some local times don't exist. Return 400 with a clear message.
- **UTC vs GMT**: Treat `UTC` as valid; `GMT` is often acceptable but technically a different concept.
- **Case Sensitivity**: IANA zone names are case-sensitive (`america/new_york` is invalid).

## Bug

The buggy version is in `src/timezone.buggy.ts`. It has **three** vulnerabilities:

1. **Wrong Timezone Applied**: It uses `new Date().toLocaleString('en-US', { timeZone })` but then returns `new Date().toISOString()` — the ISO string is always in **server local time / UTC**, not the requested zone. The locale string is thrown away.
2. **Crash on Invalid Timezone**: It passes the user-provided timezone directly to `toLocaleString` without validation. On some Node.js versions, invalid zones throw a `RangeError` that crashes the process (500 instead of 400).
3. **Locale-Dependent String Concatenation**: In the `/convert` endpoint, it manually constructs a date string using `.getMonth()`, `.getDate()`, etc. without padding, producing invalid ISO strings like `2024-6-5T3:4:5` and ignoring timezone offsets entirely. This causes parsing errors and incorrect conversions.

## Setup

```bash
cd docs_js_backend/projects/micro/M18-timezone-api
npm install
npm run dev
```

## Tests

```bash
npm test
```
