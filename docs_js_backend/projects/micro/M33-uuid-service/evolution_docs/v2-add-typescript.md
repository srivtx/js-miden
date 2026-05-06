# M33 UUID Service — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add a bulk endpoint:

```js
app.post('/uuid/bulk', (req, res) => {
  const { count = 1, type = 'v4' } = req.body;
  const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 1000);
  // ...
});
```

**The bug:** `parseInt(count, 10)` — if `count` is already a number, `parseInt` works. But if `count` is `"abc"`, `parseInt` returns `NaN`. The `|| 1` fallback handles it, but TypeScript would tell you that `count` could be a string, number, or undefined.

Another bug: you return the wrong shape for ULIDs:

```js
app.get('/uuid/ulid', (req, res) => {
  res.json({ uuid: ulid() }); // typo: should be `ulid`, not `uuid`
});
```

The client expects `{ ulid: "..." }` but gets `{ uuid: "..." }`. Integration breaks.

## The Fix: Add TypeScript

```ts
// types.ts
export type UuidType = 'v4' | 'v7' | 'ulid';

export interface BulkRequest {
  count: number;
  type: UuidType;
}

export interface UuidResponse {
  uuid?: string;
  ulid?: string;
}

export interface BulkResponse {
  count: number;
  type: UuidType;
  results: string[];
}
```

```ts
// index.ts
import express, { Request, Response } from 'express';
import { uuidV4, uuidV7, ulid, bulkGenerate } from './uuid.js';
import { UuidType, BulkRequest } from './types.js';

const app = express();
app.use(express.json());

app.get('/uuid/v4', (_req: Request, res: Response) => {
  res.json({ uuid: uuidV4() });
});

app.get('/uuid/v7', (_req: Request, res: Response) => {
  res.json({ uuid: uuidV7() });
});

app.get('/uuid/ulid', (_req: Request, res: Response) => {
  res.json({ ulid: ulid() });
});

app.post('/uuid/bulk', (req: Request, res: Response) => {
  const { count = 1, type = 'v4' } = req.body as BulkRequest;
  const n = Math.min(Math.max(parseInt(String(count), 10) || 1, 1), 1000);
  const results = bulkGenerate(n, type as UuidType);
  res.json({ count: n, type, results });
});
```

Now `tsc` errors on:
```
index.ts:15:15 - error TS2322: Type '{ uuid: string; }' is not assignable to type 'UuidResponse'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** behavior. A client can still send:
```json
{ "count": -1, "type": "v8" }
```
TypeScript sees `BulkRequest`, but at runtime the values are invalid. We need runtime validation.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But runtime validation is required because the network doesn't respect your type declarations.

## What v3 Fixes

Validation. Reject invalid counts and unsupported UUID types.
