# M33: Mental Models

## Hot Path
1. Client requests `/uuid/v4`
2. Generate 122 random bits with version (0100) and variant (10) markers
3. Format as `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
4. Return JSON response

For v7:
1. Take 48-bit Unix epoch timestamp in milliseconds
2. Append 74 random bits with version (0111) marker
3. Format similarly

## Danger Zones
- **Timestamp precision**: UUID v7 MUST use milliseconds since Unix epoch. Using seconds, microseconds, or local time breaks ordering
- **Monotonicity**: Multiple UUIDs in the same millisecond must not collide; need counter or random suffix
- **Version bits**: Hardcoding wrong version nibble makes it an invalid UUID
- **Clock drift**: System clock changes can break ordering if not handled

## Key Insight
UUID v7 is designed for database primary keys because it's time-sortable. If the timestamp is wrong, you lose the primary benefit and may get index hotspots or incorrect ordering.
