# M33: Core Concepts

## WHAT
UUID v7 encodes a 48-bit Unix timestamp (milliseconds) followed by 74 random bits.

## WHY
Time-sortable UUIDs prevent database index fragmentation and enable chronological queries without a separate timestamp column.

## HOW
```ts
const timestamp = Date.now(); // Unix epoch milliseconds
const timeHex = timestamp.toString(16).padStart(12, '0');
// timeHex + version(7) + random = UUID v7
```

## WRONG vs RIGHT

**WRONG**: Seconds instead of milliseconds
```ts
const timestamp = Math.floor(Date.now() / 1000); // BUG!
```

**RIGHT**: Milliseconds since Unix epoch
```ts
const timestamp = Date.now(); // Correct
```

The timestamp in UUID v7 occupies 48 bits. `Date.now()` returns ~1.7 trillion (13 digits), which fits in 48 bits (max ~281 trillion).
