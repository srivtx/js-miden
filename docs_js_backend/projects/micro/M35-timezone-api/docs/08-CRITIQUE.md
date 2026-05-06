# M35: Senior Engineer Review

## Strengths
- Simple API surface
- ISO 8601 input/output
- Educational demonstration of offset vs timezone rules

## Weaknesses
- **Fixed offsets are always wrong**: This is the cardinal sin of timezone handling
- **No DST edge cases handled**: Missing ambiguous/non-existent time handling
- **Limited timezone list**: Only hardcoded zones; no dynamic IANA support

## Recommendations
1. Replace entire implementation with `date-fns-tz` or `luxon`
2. If staying native, use `Intl.DateTimeFormat` with manual offset extraction
3. Store both UTC and timezone name for every scheduled event
4. Add error handling for ambiguous times (fall-back) and gaps (spring-forward)

## Grade: C+
The concept is correct, but the implementation is dangerous for real-world scheduling.
