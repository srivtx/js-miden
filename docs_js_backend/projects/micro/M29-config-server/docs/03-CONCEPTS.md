# 03-CONCEPTS: Config Server

## WHAT is a Config Server?

A Config Server is a centralized service that stores and distributes configuration properties to applications across different environments. It is the **single source of truth** for all runtime settings.

## WHY do we need it?

| Without Config Server | With Config Server |
|-----------------------|--------------------|
| Config in Git repos, deployed with code | Config deployed independently |
| Secrets in plaintext files | Encryption and access control at the server |
| Manual environment sync | Automated environment isolation |
| No audit trail | Every change logged and versioned |
| Restart required for config changes | Hot reload via polling or push |

## HOW does it work?

### The Config Coordinate

```
┌─────────────────────────────────────────────┐
│              Config Server                   │
│                                              │
│   App: myapp                                 │
│   ┌─────────────┬─────────────┬────────────┐│
│   │ dev         │ staging     │ prod       ││
│   │ dbHost: loc │ dbHost: stg │ dbHost: prd││
│   │ debug: true │ debug: false│ debug: false│
│   └─────────────┴─────────────┴────────────┘│
│                                              │
│   App: payments                              │
│   ┌─────────────┬─────────────┬────────────┐│
│   │ dev         │ staging     │ prod       ││
│   │ apiKey: dev │ apiKey: stg │ apiKey: prd││
│   └─────────────┴─────────────┴────────────┘│
└─────────────────────────────────────────────┘
```

1. **Store**: `POST /config/:app/:env` writes config for a specific app and environment.
2. **Retrieve**: `GET /config/:app/:env` reads config for a specific app and environment.
3. **Isolate**: `dev` and `prod` are completely separate namespaces.
4. **Validate**: Reject invalid configs before storing.

## WRONG vs RIGHT

### Wrong: Flat Storage

```typescript
const store: Record<string, Record<string, any>> = {};

function setConfig(app: string, env: string, config: any) {
  store[app] = { ...store[app], ...config };
}

function getConfig(app: string, env: string) {
  return store[app];
}
```

**Why Wrong:**
- **Overwrite blast**: Dev overwrites prod.
- **No isolation**: All environments share the same object.
- **Unpredictable merges**: The result depends on call order.

### Right: Hierarchical Storage

```typescript
const store: Record<string, Record<string, Record<string, any>>> = {};

function setConfig(app: string, env: string, config: any) {
  if (!store[app]) store[app] = {};
  store[app][env] = { ...store[app][env], ...config };
}

function getConfig(app: string, env: string) {
  return store[app]?.[env] ?? {};
}
```

**Why Right:**
- **Strict isolation**: `dev` and `prod` are independent objects.
- **Predictable merges**: Only the target environment is affected.
- **Safe by default**: You cannot accidentally write to prod from a dev context.

## Key Concepts

| Concept | Definition |
|---------|------------|
| Environment | A deployment stage (dev, staging, prod) with isolated settings. |
| Centralized Config | Storing all application settings in a single service. |
| Validation | Ensuring configuration values meet expected formats or constraints. |
| Namespace | A logical boundary (app × env) that prevents collisions. |
| Audit Trail | A log of every config change with timestamp and user. |

## ASCII Diagram: Environment Isolation

```
Developer A
    │
    │ POST /config/myapp/dev
    │ { dbHost: 'localhost' }
    ▼
┌─────────────────────────────────────┐
│         Config Server                │
│  ┌─────────────────────────────┐    │
│  │ myapp                       │    │
│  │   dev: { dbHost: 'local' }  │    │
│  │   prod: { dbHost: 'prod.db' }│   │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
    ▲
    │ GET /config/myapp/prod
    │
Production App
    │
    │ Returns { dbHost: 'prod.db' }
    │ (dev change had ZERO impact)
```
