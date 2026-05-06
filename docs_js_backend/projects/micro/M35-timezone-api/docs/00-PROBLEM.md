# M35: Timezone Conversion API

## WHAT
An API that converts timestamps between IANA timezones, lists supported timezones, and correctly handles Daylight Saving Time (DST) transitions.

## WHY
Global applications must display times in users' local zones. Incorrect timezone handling leads to missed appointments, billing errors, and regulatory compliance issues.

## Constraints
- Must support IANA timezone identifiers (e.g., `Asia/Tokyo`, `America/New_York`)
- Must handle ISO 8601 input timestamps
- Must list supported timezones
- Must account for DST transitions dynamically
- Must return ISO 8601 output timestamps
