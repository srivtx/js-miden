# M33: Intentional Bug

## Location
`src/uuid.ts` in `uuidV7()` function.

## Symptoms
- UUID v7 timestamps decode to year ~1970 when interpreted as milliseconds
- Database queries using UUID v7 for time range scans return wrong results
- Two UUIDs generated 1 second apart have identical prefixes (because timestamp is in seconds)

## Reproduction
```ts
const uuid = uuidV7();
const timeHex = uuid.split('-')[0] + uuid.split('-')[1];
const ts = parseInt(timeHex, 16);
console.log(ts); // ~1700000000 (seconds, should be ~1700000000000 ms)
```

## Root Cause
```ts
const timestamp = Math.floor(now.getTime() / 1000); // Seconds, not milliseconds!
```

## Fix
```ts
const timestamp = now.getTime(); // Unix epoch milliseconds
```

## Real-World Impact
Using seconds reduces timestamp precision by 1000x, causing massive UUID collisions within the same second. In databases using UUID v7 as primary keys, this destroys the time-sortability benefit and causes index contention (hotspotting).
