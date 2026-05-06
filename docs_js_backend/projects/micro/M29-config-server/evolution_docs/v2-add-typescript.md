# M29 Config Server — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You refactor v1 to support environments:

```js
app.post('/config/:app/:env', (req, res) => {
  const { app: appName, env } = req.params;
  const cfg = readConfig();
  cfg[appName] = { ...cfg[appName], ...req.body };
  writeConfig(cfg);
  res.json({ status: 'ok' });
});
```

**The bug:** `env` is destructured but never used. You meant to write `cfg[appName][env]`, but you wrote `cfg[appName]`. JavaScript doesn't care. The parameter is silently ignored. Dev configs overwrite prod configs for months before anyone notices.

Another bug: a teammate refactors and changes the return shape:

```js
app.get('/config/:app/:env', (req, res) => {
  const cfg = readConfig();
  res.json({ config: cfg[req.params.app] });
});
```

The frontend expects a flat object, not `{ config: {...} }`. No compiler warns you. Production breaks on deploy.

## The Fix: Add TypeScript

```ts
// types.ts
export interface ConfigStore {
  [app: string]: {
    [env: string]: Record<string, unknown>;
  };
}

export interface ConfigResponse {
  status: string;
  app: string;
  env: string;
}
```

```ts
// config.ts
const store: ConfigStore = {};

export function setConfig(app: string, env: string, config: Record<string, unknown>): void {
  if (!store[app]) store[app] = {};
  store[app][env] = { ...store[app][env], ...config };
}

export function getConfig(app: string, env: string): Record<string, unknown> {
  return store[app]?.[env] ?? {};
}
```

```ts
// index.ts
app.post('/config/:app/:env', (req: Request, res: Response) => {
  const { app: appName, env } = req.params;
  // TypeScript ensures you CANNOT forget to use `env`
  setConfig(appName, env, req.body);
  res.json({ status: 'ok', app: appName, env });
});
```

Now `tsc` errors on:
```
config.ts:5:11 - error TS2339: Property 'env' does not exist on type '...'
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** data. A client can still send:
```json
{ "port": "not-a-number", "timeout": -1 }
```
TypeScript believes it's `Record<string, unknown>`, but at runtime it's invalid. The store now contains garbage.

> **Lesson:** TypeScript eliminates an entire class of developer errors. But runtime validation is still required because the network doesn't respect your type declarations.

## What v3 Fixes

Validation. Stop garbage configs from entering the system.
