# v3: Add Validation — Load Balancer

## The Pain

You add a backend with a bad port:

```typescript
backends.push({ port: 999999, healthy: true });
```

It compiles. TypeScript doesn't complain because `port` is `number`. The load balancer tries to proxy to port 999999. `http.request` throws:

```
RangeError: port should be >= 0 and < 65536
```

The error is unhandled. The load balancer crashes. All traffic stops because one backend has an invalid port.

## The Solution

Validate backend configuration at registration and on health checks.

## Before (No Validation)

```typescript
// src/balancer.ts
interface Backend {
  port: number;
  healthy: boolean;
}

const backends: Backend[] = [
  { port: 3001, healthy: true },
  { port: 3002, healthy: true },
  { port: 3003, healthy: true },
];
```

## After (With Validation)

```typescript
// src/validation.ts
export function validateBackend(backend: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!backend || typeof backend !== 'object') {
    errors.push('backend must be an object');
    return { valid: false, errors };
  }

  if (!Number.isInteger(backend.port) || backend.port < 1 || backend.port > 65535) {
    errors.push('port must be an integer between 1 and 65535');
  }

  if (typeof backend.healthy !== 'boolean') {
    errors.push('healthy must be a boolean');
  }

  if (backend.weight !== undefined) {
    if (!Number.isInteger(backend.weight) || backend.weight < 1) {
      errors.push('weight must be a positive integer');
    }
  }

  return { valid: errors.length === 0, errors };
}
```

```typescript
// src/balancer.ts
import { validateBackend } from './validation.js';

export function addBackend(backend: Backend): void {
  const validation = validateBackend(backend);
  if (!validation.valid) {
    throw new Error(`Invalid backend: ${validation.errors.join(', ')}`);
  }
  backends.push(backend);
}
```

## The Bug It Catches

- `port: 999999` → `Error: port must be an integer between 1 and 65535`
- `port: "3001"` → `Error: port must be an integer between 1 and 65535`
- `healthy: "yes"` → `Error: healthy must be a boolean`
- `weight: 0` → `Error: weight must be a positive integer`

## Why Validation Matters

- **Crash prevention**: Invalid backends are rejected at registration, not at proxy time
- **TypeScript gap**: `number` includes `NaN`, `Infinity`, `999999`. Validation closes the gap.
- **Config safety**: Env var `BACKEND_PORTS=3001,3002,abc` fails fast with a clear error
- **Consistency**: Every backend in the array is guaranteed valid

Without validation, one bad backend crashes the balancer. With validation, bad config is caught at startup.
