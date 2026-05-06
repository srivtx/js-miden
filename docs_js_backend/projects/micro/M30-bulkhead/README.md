# M30: Bulkhead Pattern

An implementation of the bulkhead pattern that isolates resources into separate pools so failures in one pool do not affect others.

## Features

- Pool A: Dedicated to critical requests (user-facing API)
- Pool B: Dedicated to background jobs (data processing)
- Enforced pool size limits
- Rejection of requests when a pool is full instead of queueing indefinitely

## Bug Introduced

The implementation uses a **shared pool** for both critical requests and background jobs. When background jobs exhaust the pool, critical user-facing requests are rejected. This violates the core purpose of the bulkhead pattern.

## Project Structure

```
M30-bulkhead/
├── src/
│   ├── index.ts      # Express server setup
│   ├── bulkhead.ts   # Bulkhead pattern implementation
│   └── pool.ts       # Pool management
├── tests/
│   └── bulkhead.test.ts
├── docs/
│   ├── 01-what.md
│   ├── 02-why.md
│   ├── 03-how.md
│   ├── 04-wrong-vs-right.md
│   ├── 05-architecture.md
│   ├── 06-setup.md
│   ├── 07-testing.md
│   ├── 08-troubleshooting.md
│   └── 09-reference.md
├── package.json
├── tsconfig.json
└── README.md
```

## Quick Start

```bash
npm install
npm run dev    # Start server on :3000
npm test       # Run tests (some will fail due to the bug)
```

## Pools

| Pool | Purpose | Max Size |
|------|---------|----------|
| A    | Critical Requests | 3 |
| B    | Background Jobs | 3 |

## Testing the Bug

Run `npm test`. The isolation test will fail because Pool B exhaustion causes Pool A requests to be rejected.
