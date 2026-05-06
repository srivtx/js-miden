# WRONG vs RIGHT: Config Server

## The Bug: No Environment Isolation

### Wrong (Current Code)

```typescript
// src/config.ts
const store: Record<string, Record<string, any>> = {};

function setConfig(app: string, env: string, config: any) {
  // BUG: ignores env, overwrites all environments!
  store[app] = config;
}

function getConfig(app: string, env: string) {
  // Returns the same config regardless of env
  return store[app];
}
```

**Why It's Wrong:**
- Setting config for `dev` overwrites `prod`.
- Production services may receive development settings.
- There is no way to have different values per environment.

### Right (Fixed Code)

```typescript
// src/config.ts
const store: Record<string, Record<string, Record<string, any>>> = {};

function setConfig(app: string, env: string, config: any) {
  if (!store[app]) {
    store[app] = {};
  }
  store[app][env] = { ...store[app][env], ...config };
}

function getConfig(app: string, env: string) {
  return store[app]?.[env] ?? {};
}
```

**Why It's Right:**
- Each app has a separate object per environment.
- `dev`, `staging`, and `prod` are fully isolated.
- Setting `dev` config never affects `prod`.

## Key Takeaway

Environment isolation is not optional in a config server. Without it, the config server is a liability rather than an asset.
