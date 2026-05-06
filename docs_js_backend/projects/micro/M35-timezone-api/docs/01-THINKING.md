# M35: Mental Models

## Hot Path
1. Parse ISO 8601 input time in source timezone
2. Determine target timezone's offset at that exact instant
3. Apply offset to get target time
4. Return ISO 8601 string

## Danger Zones
- **DST transitions**: Offsets change twice a year. A fixed offset map is always wrong for DST-observing zones
- **Ambiguous times**: "Fall back" creates duplicate local times (1:30 AM happens twice)
- **Non-existent times**: "Spring forward" skips local times (2:30 AM doesn't exist)
- **IANA database updates**: Timezone rules change due to politics; hardcoded rules go stale

## Key Insight
Timezones are not offsets; they are rules. `America/New_York` means "apply EST (-5) or EDT (-4) depending on the date." You cannot represent this with a single number. You need the IANA database or a library like `date-fns-tz` or `luxon`.
