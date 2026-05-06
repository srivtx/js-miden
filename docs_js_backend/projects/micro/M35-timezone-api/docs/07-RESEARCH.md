# M35: Research & Citations

## Standards
- IANA Time Zone Database: https://www.iana.org/time-zones
- ISO 8601: Date and time representation
- RFC 3339: Internet Date/Time Format

## npm Trends
- `moment-timezone`: 5M+ downloads/week (legacy)
- `date-fns-tz`: 2M+ downloads/week (modern)
- `luxon`: 1M+ downloads/week (wrapper around Intl)

## Benchmarks
- Fixed offset map (this project): ~5M ops/sec
- `Intl.DateTimeFormat`: ~100K ops/sec (slower but correct)
- `luxon`: ~80K ops/sec

## Best Practices
- Never store times in local timezone; always store UTC
- Use IANA identifiers (`America/New_York`) instead of abbreviations (`EST`)
- Update ICU/IANA database regularly; timezone rules change due to legislation
- For scheduling, store the original timezone name alongside the UTC timestamp
