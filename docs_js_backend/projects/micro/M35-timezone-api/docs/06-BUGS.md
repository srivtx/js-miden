# M35: Intentional Bug

## Location
`src/timezone.ts` in `convertTime()` function.

## Symptoms
- Converting UTC to `America/New_York` in July returns UTC-5 instead of UTC-4 (EDT)
- Converting UTC to `Europe/London` in January returns UTC+1 instead of UTC+0 (GMT)
- Appointment scheduling shows wrong local times for half the year

## Reproduction
```ts
convertTime('UTC', 'America/New_York', '2024-07-01T12:00:00Z');
// Returns 07:00 instead of correct 08:00
```

## Root Cause
```ts
const fixedOffsets = { 'America/New_York': -5 }; // Ignores DST
const offsetDiffHours = toOffset - fromOffset;
```

## Fix
Use dynamic IANA lookup:
```ts
function getOffset(timeZone: string, date: Date): number {
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (tzDate.getTime() - utcDate.getTime()) / 3600000;
}
```

## Real-World Impact
A medical scheduling app using fixed offsets caused patients to arrive 1 hour early or late for appointments during DST transitions. In financial trading, 1-hour errors can violate market open/close regulations.
