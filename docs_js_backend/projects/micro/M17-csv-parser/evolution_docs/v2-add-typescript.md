# M17 CSV Parser — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add options to your parser:

```js
function parseCsv(csvText, options) {
  const maxRows = options.maxrows || 10000; // typo: maxrows vs maxRows
  // ...
}
```

**The bug:** `options.maxrows` is `undefined` because the caller passed `maxRows`. Your parser never enforces the limit. An attacker uploads 1 million rows and crashes the server.

Another bug:
```js
// You expect options.requiredHeaders to be string[]
for (const h of options.requiredHeaders) {
  // If caller passes a string, this iterates over characters!
}
```

## The Fix: Add TypeScript

```ts
// parser.ts
export interface ParseOptions {
  requiredHeaders?: string[];
  maxRows?: number;
  maxCellLength?: number;
}

export interface ParseResult {
  rowCount: number;
  headers: string[];
  data: Record<string, string>[];
}

export function parseCsvSafe(csvText: string, options: ParseOptions = {}): ParseResult {
  const { requiredHeaders = [], maxRows = 10000, maxCellLength = 10000 } = options;
  // TypeScript ensures options shape is correct at compile time
  // ...
}
```

```ts
// index.ts
app.post('/upload-csv', async (req: Request, res: Response) => {
  const csvText = req.body.csv || '';
  const requiredHeaders = (req.body.requiredHeaders as string | undefined)
    ?.split(',')
    .filter(Boolean) || [];
  const maxRows = Number(req.body.maxRows) || 10000;

  const result = parseCsvSafe(csvText, { requiredHeaders, maxRows });
  res.json({ success: true, ...result });
});
```

**What TS catches:**
- `options.maxrows` → compile error: `Property 'maxrows' does not exist on type 'ParseOptions'`
- `requiredHeaders?: string[]` — callers can't pass a string accidentally
- `parseCsvSafe` return type is explicit — no guessing what the result contains

## The Pain That Remains

TypeScript doesn't stop formula injection. `=cmd|(' /C calc')!A0` is a valid `string`. TypeScript doesn't enforce memory limits. A million-row CSV is still valid `string`. We need runtime validation.

## What v3 Fixes

Validation. Sanitize cells, enforce limits, check headers.
