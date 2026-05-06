# M32: Intentional Bug

## Location
`src/negotiator.ts` in `selectFormat()` function.

## Symptoms
- Request with `Accept: */*` returns JSON (default fallback), but the negotiation logic reports "no match"
- Clients sending broad wildcards get correct format by accident, but internal metrics/logic think negotiation failed
- Middleware that checks `format === null` for analytics records false negatives

## Reproduction
```ts
const items = parseAcceptHeader('*/*');
const format = selectFormat(items, ['json', 'xml']);
console.log(format); // null (BUG: should be 'json')
```

## Root Cause
Exact string match without wildcard handling:
```ts
if (item.type === t && item.subtype === s) return format;
// Never matches because item.subtype is '*', not 'json'
```

## Fix
```ts
if (
  (item.type === t && item.subtype === s) ||
  (item.type === t && item.subtype === '*') ||
  (item.type === '*' && item.subtype === '*')
) return format;
```

## Real-World Impact
A monitoring dashboard showing "negotiation failures" spams alerts. API gateways using custom negotiation logic may reject valid requests, causing cascading client errors.
