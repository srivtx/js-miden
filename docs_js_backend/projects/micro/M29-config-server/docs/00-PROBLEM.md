# 00-PROBLEM: Config Server

## WHAT is the problem?

A Config Server centralizes application configuration across environments. The problem is that **without environment isolation**, updating development settings overwrites production settings, causing production outages.

## WHY does this matter?

- **Production outages**: A developer setting `debug: true` or `dbHost: localhost` in dev can overwrite prod if environments aren't isolated.
- **Blast radius**: One team's misconfiguration can affect every environment.
- **Compliance**: Regulations often require separation of dev/prod data and settings.

## HOW does the bug manifest?

The current `src/config.ts` stores config **only by app name**, completely ignoring the `env` parameter:

```typescript
const store: Record<string, Record<string, any>> = {};

export function setConfig(app: string, env: string, config: any) {
  // BUG: The 'env' parameter is completely ignored!
  store[app] = { ...store[app], ...config };
}

export function getConfig(app: string, env: string) {
  // BUG: Returns the same config regardless of environment
  return store[app] || {};
}
```

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Fixed) |
|--------|-----------------|---------------|
| Storage key | `store[app]` | `store[app][env]` |
| Dev/prod isolation | None | Strict separation |
| Config merge behavior | Merges across environments | Merges within same environment only |
| Blast radius | Global per app | Scoped per environment |

## ASCII Diagram: The Overwrite Disaster

```
Developer                Config Server                 Production App
  |                            |                            |
  | POST /config/myapp/dev     |                            |
  | { dbHost: 'localhost' }    |                            |
  |--------------------------->|                            |
  |                            | store['myapp'] = {         |
  |                            |   dbHost: 'localhost'      |
  |                            | }                          |
  |                            |                            |
  |                            |                            | GET /config/myapp/prod
  |                            |                            |------------------------->|
  |                            |                            |
  |                            |                            |<-- { dbHost: 'localhost' }
  |                            |                            |
  |                            |                            | (Connects to localhost,
  |                            |                            |  production is DOWN)
```

## Real-World Impact

In 2018, a fintech startup's config server had a similar bug. A junior developer updated the `dev` environment config for the payment gateway, but the server stored it globally. The production payment service restarted, picked up the dev config (pointing to a sandbox API), and failed to process $2.3M in transactions over 4 hours before the misconfiguration was detected.
