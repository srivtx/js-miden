# v6-switch-to-esm.md — "My imports are a mess"

## The Bug

You're using CommonJS:

```js
const express = require('express');
const { Redis } = require('ioredis');

module.exports = { increment, getCount };
```

You want to use `Redis` as a type in TypeScript:

```ts
/** @type {import('ioredis').Redis} */
const redis = require('ioredis');
```

This JSDoc annotation is a workaround. TypeScript with ESM handles this natively:

```ts
import { Redis } from 'ioredis';
```

## The 3am Page, Redux

You have a test file that mocks Redis:

```js
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
  }));
});
```

This works with CommonJS and Jest. But with ESM, `jest.mock` is more complex. You switch to Vitest, which has native ESM support:

```ts
import { vi } from 'vitest';

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
  })),
}));
```

This is cleaner, works with ESM, and is the modern standard.

## Why ESM?

- **Type imports** — `import type { Redis } from 'ioredis'` is explicit and tree-shakeable
- **Native mocking** — Vitest's ESM mocking is more reliable than Jest's
- **Static analysis** — bundlers understand your dependency graph
- **Top-level await** — conditionally load Redis config at module scope
- **Node.js default** — Node 20+ prefers ESM. CommonJS is legacy.

## The Migration

### 1. Add `"type": "module"` to `package.json`

```json
{
  "name": "m04-counter-api",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/src/index.js",
    "test": "vitest run"
  }
}
```

### 2. Change `require` to `import`

```ts
// Before
const express = require('express');
const { Redis } = require('ioredis');

// After
import express from 'express';
import { Redis } from 'ioredis';
```

### 3. Change `module.exports` to `export`

```ts
// Before
module.exports = { increment, getCount };

// After
export async function increment(): Promise<number> { ... }
export async function getCount(): Promise<number> { ... }
```

### 4. Update `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  }
}
```

### 5. Add `.js` to relative imports

```ts
// Before
import { increment, getCount } from './counter';

// After
import { increment, getCount } from './counter.js';
```

## What Changed

- `"type": "module"` in `package.json`
- `require` → `import`
- `module.exports` → `export`
- `tsconfig.json` uses `"module": "NodeNext"`
- Relative imports include `.js` extension
- Type imports are explicit and tree-shakeable

## What We Still Need

We've built a typed, validated, tested, ESM application. Now we need to see the final structure and understand how all the pieces fit together.

For that, we need the production setup.
