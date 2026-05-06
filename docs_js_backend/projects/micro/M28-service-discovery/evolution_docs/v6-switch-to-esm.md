# v6: Switch to ESM — Service Discovery

## The Pain

Your service discovery registry conditionally loads plugins:

```typescript
if (process.env.USE_REDIS) {
  const redis = require('redis'); // dynamic require
}
```

This works in CJS but is forbidden in ESM. When you add `"type": "module"`, it breaks. Worse, dynamic `require` hides dependencies from your bundler and security scanner.

## The Solution

Use ESM static imports and conditional initialization.

## Before (CJS)

```typescript
// src/index.ts
import express from 'express';
import { registerService } from './registry';

if (process.env.USE_REDIS) {
  const redis = require('redis'); // breaks in ESM
}
```

## After (ESM)

```json
// package.json
{
  "name": "m28-service-discovery",
  "type": "module",
  "main": "dist/index.js"
}
```

```typescript
// src/index.ts
import express from 'express';
import { registerService, getServices, updateHeartbeat } from './registry.js';
import { startCleanup } from './heartbeat.js';

// Conditional initialization with static imports
let redisClient: any = null;
if (process.env.USE_REDIS) {
  const { createClient } = await import('redis');
  redisClient = createClient();
}
```

## Why ESM in 2025

ESM's static imports are a feature, not a limitation. They force you to declare dependencies upfront, which means:
- **Security scanners** (Snyk, Dependabot) see every package you use
- **Bundlers** (esbuild, rollup) can eliminate dead code
- **TypeScript** can type-check every import path at compile time

## The Bug It Catches

In CJS, this compiles but fails at runtime:

```typescript
const { startCleanup } = require('./heartbeet'); // typo
```

TypeScript ESM with `"moduleResolution": "NodeNext"` catches the typo at compile time because the file must literally exist with that exact name.
