# M35: Design Decisions

## Option A: Fixed offset map (as implemented)
- **Pros**: Zero dependencies, fast, simple
- **Cons**: Wrong for half the year in DST zones; politically fragile
- **Chosen**: Yes, as the intentionally buggy baseline

## Option B: Use `Intl.DateTimeFormat` with `timeZone` option
- **Pros**: Native, no dependencies, uses ICU database
- **Cons**: No direct "convert" API; must format and parse
- **Chosen**: No for initial implementation, but recommended for fix

## Option C: Use `date-fns-tz` or `luxon`
- **Pros**: Clean API, correct DST handling, timezone-aware arithmetic
- **Cons**: Adds dependency, bundle size
- **Chosen**: No for curriculum, but mandatory for production

## Decision
Implement fixed offsets to demonstrate why they fail, then refactor to use `Intl.DateTimeFormat` or a proper library.
