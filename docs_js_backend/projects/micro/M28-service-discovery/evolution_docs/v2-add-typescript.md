# v2: Add TypeScript — Service Discovery

## The Pain

You write the registry in JavaScript:

```javascript
// src/registry.js
function registerService(name, url) {
  const service = {
    id: randomUUID(),
    name,
    url,
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
  };
  registry.push(service);
  return service;
}

function getServices(name) {
  return registry.filter(s => s.name === name);
}
```

Later, you try to filter by TTL:

```javascript
function getServices(name) {
  const now = Date.now();
  return registry.filter(s =>
    s.name === name && (now - s.lastHeartbeet) <= TTL // BUG: typo
  );
}
```

`lastHeartbeet` is `undefined`. `now - undefined` is `NaN`. `NaN <= 3000` is `false`. Every service is filtered out. The registry returns empty arrays for all queries. Services that are alive appear dead.

## The Solution

Add TypeScript. Define the `Service` interface.

## After (With TypeScript)

```typescript
// src/registry.ts
export interface Service {
  id: string;
  name: string;
  url: string;
  registeredAt: number;
  lastHeartbeat: number;
}

const registry: Service[] = [];
const TTL = 3000;

export function registerService(name: string, url: string): Service {
  const service: Service = {
    id: randomUUID(),
    name,
    url,
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
  };
  registry.push(service);
  return service;
}

export function getServices(name: string): Service[] {
  const now = Date.now();
  return registry.filter(s =>
    s.name === name && (now - s.lastHeartbeat) <= TTL
  );
}
```

## The Bug TypeScript Catches

- `s.lastHeartbeet` → `Property 'lastHeartbeet' does not exist on type 'Service'. Did you mean 'lastHeartbeat'?`
- `registerService('user-service')` → `Expected 2 arguments, but got 1`
- `registerService('user-service', 3001)` → `Argument of type 'number' is not assignable to parameter of type 'string'`
- `registry.push({ name: 'x', url: 'y' })` → `Property 'id' is missing`

## Why TypeScript Matters

- **Typos**: The compiler suggests `lastHeartbeat` for `lastHeartbeet`
- **Required fields**: `Service` interface forces `id`, `registeredAt`, `lastHeartbeat`
- **Type safety**: URLs are strings, timestamps are numbers
- **Refactoring**: Rename `lastHeartbeat` → `lastSeen` and every usage updates

Without TypeScript, a typo makes every service appear dead. With TypeScript, the compiler catches the typo before you deploy.
