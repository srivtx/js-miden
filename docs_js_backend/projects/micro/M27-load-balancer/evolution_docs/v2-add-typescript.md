# v2: Add TypeScript — Load Balancer

## The Pain

You write the load balancer in JavaScript:

```javascript
// src/balancer.js
let counter = 0;

function selectBackend() {
  if (backends.length === 0) return null;
  const backend = backends[counter % backends.length];
  counter++;
  return backend;
}
```

Later, you add health checks:

```javascript
function setBackendHealth(port, healthy) {
  const backend = backends.find(b => b.port === port);
  if (backend) {
    backend.health = healthy; // BUG: property name is 'healthy', not 'health'
  }
}
```

`backend.health = healthy` creates a new property `health` instead of updating `healthy`. The balancer still sees `healthy: true` and routes to the dead backend. The typo is silent.

## The Solution

Add TypeScript. Define the `Backend` interface.

## After (With TypeScript)

```typescript
// src/balancer.ts
export interface Backend {
  port: number;
  healthy: boolean;
}

let counter = 0;

export function selectBackend(): Backend | null {
  if (backends.length === 0) return null;
  const backend = backends[counter % backends.length];
  counter++;
  return backend;
}

export function setBackendHealth(port: number, healthy: boolean): void {
  const backend = backends.find(b => b.port === port);
  if (backend) {
    backend.healthy = healthy; // TypeScript enforces 'healthy', not 'health'
  }
}
```

## The Bug TypeScript Catches

- `backend.health = healthy` → `Property 'health' does not exist on type 'Backend'. Did you mean 'healthy'?`
- `setBackendHealth('3001', true)` → `Argument of type 'string' is not assignable to parameter of type 'number'`
- `backends.push({ port: 3001 })` → `Property 'healthy' is missing in type '{ port: number; }' but required in type 'Backend'`
- `selectBackend().port` → `Object is possibly 'null'` (forces null check)

## Why TypeScript Matters

- **Property names**: The compiler suggests `healthy` when you type `health`
- **Null safety**: `Backend | null` forces callers to handle the all-down case
- **Type safety**: `port: number` prevents string ports
- **Interface contracts**: Every backend must have `port` and `healthy`

Without TypeScript, a typo in a property name silently breaks health checks. With TypeScript, the compiler corrects you.
