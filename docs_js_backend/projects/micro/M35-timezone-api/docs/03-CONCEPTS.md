# M35: Core Concepts

## WHAT
IANA timezones are rulesets, not fixed offsets. `America/New_York` means "EST or EDT depending on the date."

## WHY
Fixed offsets ignore DST, causing 1-hour errors for 6 months of the year in affected zones.

## HOW
```ts
// WRONG: Fixed offset
const nyOffset = -5; // Always wrong in summer

// RIGHT: Use IANA rules
const converted = new Date(input);
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});
```

## WRONG vs RIGHT

**WRONG**: Fixed offset map
```ts
const offsets = { 'America/New_York': -5 };
```

**RIGHT**: Dynamic lookup per timestamp
```ts
// Use Intl.DateTimeFormat or luxon to compute offset at specific instant
```
