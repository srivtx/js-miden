# M18 Timezone API — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
M18-timezone-api/
├── src/
│   ├── index.ts           # Express routes
│   ├── timezone.ts        # Safe timezone logic
│   └── timezone.buggy.ts  # Intentionally buggy (for comparison)
├── tests/
│   └── app.test.ts        # Vitest + supertest
├── evolution_docs/        # This documentation
├── package.json
├── tsconfig.json
└── dist/                  # Compiled JS (gitignored)
```

### Key Production Decisions

**1. IANA Database via `Intl.supportedValuesOf`**

```ts
const VALID_TIMEZONES = new Set(
  Intl.supportedValuesOf('timeZone')
);
```

No manual offset tables. No hardcoded lists. The IANA timezone database is built into Node.js via V8's ICU data. It handles:
- Zone additions (e.g., `America/Nuuk` replacing `America/Godthab`)
- DST rule changes (e.g., Egypt abolishing DST)
- Historical corrections

**2. `Intl.DateTimeFormat` for Accurate Wall-Clock Time**

```ts
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: timezone,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
  timeZoneName: 'shortOffset',
}).formatToParts(now);
```

We extract parts (year, month, day, hour, offset) and reconstruct an ISO 8601 string. This is the only reliable way to get wall-clock time in a specific zone.

**3. DST Detection via Offset Comparison**

```ts
const janOffset = getOffsetMinutes(timezone, new Date(Number(year), 0, 1));
const julOffset = getOffsetMinutes(timezone, new Date(Number(year), 6, 1));
const currentOffset = getOffsetMinutes(timezone, now);
const isDST = Math.max(janOffset, julOffset) !== currentOffset;
```

This works for both northern and southern hemispheres because it compares the current offset against both standard offsets.

**4. ISO 8601 Validation for convertTime**

```ts
const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/;
if (!isoRegex.test(timeString)) {
  throw new Error('Time must be in ISO 8601 format');
}
```

Prevents garbage input from reaching `new Date()`, which has notoriously permissive parsing.

**5. Self-execution Guard**

```ts
export default app;
```

Tests import `app` directly without starting the server.

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | Returns UTC always, crashes on invalid zones, bad ISO strings | Wrote naive JS |
| v2 | Type errors at runtime | Added TypeScript |
| v3 | Server crashes, ambiguous times | Added validation + ISO regex |
| v4 | Silent bugs in production | Added structured logging |
| v5 | Regressions on refactor | Added vitest + supertest |
| v6 | Legacy module system | Switched to ESM |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # tsx watch src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # vitest run
```
