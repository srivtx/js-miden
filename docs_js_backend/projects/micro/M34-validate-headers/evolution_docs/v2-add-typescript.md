# M34 Validate Headers — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add header validation:

```js
app.use((req, res, next) => {
  const contentType = req.headers['Content-Type']; // typo: wrong case
  if (!contentType) {
    return res.status(400).json({ error: 'Missing Content-Type' });
  }
  next();
});
```

**The bug:** `req.headers['Content-Type']` is `undefined` because Node.js lowercases keys. You meant `req.headers['content-type']`. JavaScript silently returns `undefined`. Every request is rejected.

Another bug: you treat header values as always strings:

```js
const auth = req.headers['authorization'];
if (auth.startsWith('Bearer ')) { // TypeError: auth.startsWith is not a function
```

`req.headers['authorization']` can be a string array when multiple headers are sent. TypeScript would flag this.

## The Fix: Add TypeScript

```ts
// validator.ts
export type ValidationMode = 'strict' | 'lenient';

export interface HeaderRule {
  name: string;
  required: boolean;
  pattern?: RegExp;
  validate?: (value: string) => boolean;
}
```

```ts
// index.ts
import express, { Request, Response, NextFunction } from 'express';
import { validateHeaders, defaultRules } from './validator.js';

const app = express();
app.use(express.json());
app.use(validateHeaders(defaultRules, 'lenient'));

app.get('/public', (req: Request, res: Response) => {
  res.json({ message: 'public endpoint', warnings: (req as any).headerWarnings });
});
```

Now `tsc` errors on:
```
index.ts:5:28 - error TS2339: Property 'startsWith' does not exist on type 'string | string[]'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** behavior. A client can still send:
```
Content-Type: application/json
content-type: text/plain
```

Node.js merges them into an array. TypeScript sees `string | string[]`. Your code might only handle the string case. We need runtime validation.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But runtime validation is required because HTTP headers are messy.

## What v3 Fixes

Validation. Regex-based header validation with strict and lenient modes.
