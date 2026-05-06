# M18: Timezone API — Overview

## WHAT

The **Timezone API** is a microservice that converts timestamps between timezones, lists available IANA zones, and calculates offsets including Daylight Saving Time (DST) transitions. It exposes endpoints such as:

- `GET /zones` — list supported IANA timezone identifiers.
- `GET /convert?from=America/New_York&to=Europe/Berlin&time=2024-06-15T14:00:00Z` — convert a UTC instant to local time in another zone.
- `GET /offset?zone=Asia/Tokyo&time=2024-01-01T00:00:00Z` — return the UTC offset at a given instant.

## WHY

Time is deceptively simple but politically complex. Timezone rules change due to legislation (e.g., Russia abolishing DST in 2014, Samoa skipping a day in 2011). Storing or displaying time incorrectly can cause:

- Missed appointments in scheduling apps.
- Incorrect financial trade timestamps (regulatory violation).
- Data corruption in distributed logs.

## HOW

**Architecture principles:**

1. **Store in UTC, display in local time.** UTC is an absolute coordinate; local time is a presentation concern.
2. **Use the IANA timezone database.** Do not hardcode offsets.
3. **Leverage the `Intl.DateTimeFormat` API** in Node.js for locale-aware formatting.
4. **Accept and return ISO 8601 strings** to avoid ambiguity.

**Minimal correct flow:**

```javascript
// 1. Receive ISO 8601 input
const input = "2024-06-15T14:00:00Z"; // Z = UTC

// 2. Parse to absolute instant (Unix epoch ms)
const instant = Date.parse(input);

// 3. Convert to target zone using Intl
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  timeZoneName: "short"
});
console.log(formatter.format(instant));
// → "06/15/2024, 04:00:00 PM GMT+2"
```

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Store `2024-06-15 14:00:00` without timezone or offset. | Store `2024-06-15T14:00:00Z` (UTC) alongside the target zone name. |
| Hardcode `EST = -5` forever. | Use `America/New_York`; let tzdb resolve EST (-5) vs EDT (-4). |
| Use client-local time for server timestamps. | Generate all server-side timestamps in UTC; convert for display only. |
| Parse ambiguous strings with `new Date("03/10/2024 02:30")`. | Use ISO 8601 or explicit zone + unambiguous instant. |

## References

- IANA Time Zone Database: https://www.iana.org/time-zones
- ECMAScript `Intl` API: https://tc39.es/ecma402/
- RFC 3339 (Date and Time on the Internet): https://datatracker.ietf.org/doc/html/rfc3339
