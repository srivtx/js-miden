# M32 Content Negotiation — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts malformed Accept headers:

```bash
curl -H "Accept: application/json; q=not-a-number" http://localhost:3000/resource
curl -H "Accept: " http://localhost:3000/resource
curl -H "Accept: image/png, video/mp4" http://localhost:3000/resource
```

Your parser tries `parseFloat('not-a-number')` and gets `NaN`. The sort comparator breaks. The empty header causes a split on `''` and returns `['']`. The unsupported formats cause `selectFormat` to return `null`, but your fallback logic might not handle it.

## The Fix: Validate Accept Headers

```ts
// validator.ts
export function validateAcceptHeader(header: string): { valid: boolean; error?: string } {
  if (!header || header.trim().length === 0) {
    return { valid: true }; // empty Accept = */*
  }

  const parts = header.split(',');
  for (const part of parts) {
    const [media, ...params] = part.split(';');
    if (!media.trim().includes('/')) {
      return { valid: false, error: `Invalid media type: ${media}` };
    }

    for (const param of params) {
      const trimmed = param.trim();
      if (trimmed.startsWith('q=')) {
        const q = parseFloat(trimmed.slice(2));
        if (isNaN(q) || q < 0 || q > 1) {
          return { valid: false, error: `Invalid q-value: ${trimmed}` };
        }
      }
    }
  }

  return { valid: true };
}
```

```ts
// negotiator.ts
export function parseAcceptHeader(header: string): AcceptItem[] {
  if (!header) return [{ type: '*', subtype: '*', q: 1.0 }];

  return header
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      const [media, ...params] = part.split(';');
      const [type, subtype] = media.trim().split('/');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1.0;
      return { type: type.trim(), subtype: subtype.trim(), q };
    })
    .sort((a, b) => b.q - a.q);
}
```

**What this prevents:**
- `NaN` q-values breaking sort
- Empty headers causing parse errors
- Invalid media types

## The Pain That Remains

You deploy to production. A user reports that `Accept: */*` returns JSON instead of their preferred format. You check the logs — there are no logs. You can't tell what format was selected or why.

## What v4 Fixes

Logging. Production without logs is flying blind.
