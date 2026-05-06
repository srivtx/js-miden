# 04-OLD-VS-NEW: Config Server

## WHAT changed between 2015 and 2025?

Config management evolved from **static property files checked into Git** to **dynamic, encrypted, environment-scoped configuration with feature flags and gradual rollouts**.

## WHY did it change?

Deploying config with code was too slow for modern CI/CD. Teams needed to change feature flags without redeploying. Security requirements demanded encryption at rest and access control. The industry moved from files to services.

## HOW did it change?

### 2015: Property Files in Git

```properties
# application.properties (2015)
db.host=localhost
db.port=5432
api.key=dev-key-123
```

```properties
# application-prod.properties (2015)
db.host=prod.db.example.com
db.port=5432
api.key=prod-key-456
```

**Pros:**
- Simple; no infrastructure needed.
- Version controlled via Git.

**Cons:**
- Secrets in Git (security risk).
- Requires redeploy to change config.
- No runtime validation.
- Environment files are manual and error-prone.

### 2025: Cloud-Native Config with Feature Flags

```yaml
# AWS AppConfig (2025)
Application: MyApp
Environment: Production
ConfigurationProfile: FeatureFlags
DeploymentStrategy: Canary10Percent5Minutes
```

```json
// LaunchDarkly feature flag (2025)
{
  "flagKey": "new-checkout-flow",
  "variations": [false, true],
  "rules": [
    {
      "clauses": [
        { "attribute": "country", "op": "in", "values": ["US"] }
      ],
      "variation": 1
    }
  ],
  "defaultRule": { "variation": 0 }
}
```

**Pros:**
- Hot reload without restart.
- Feature flags enable canary deployments and A/B testing.
- Encryption at rest and in transit.
- Fine-grained access control (who can change prod).
- Audit trails and versioning.

**Cons:**
- External dependency; if the config service is down, apps may fail to start.
- Complexity of feature flag logic can introduce bugs.

## WRONG vs RIGHT

| Aspect | OLD (2015) | NEW (2025) |
|--------|------------|------------|
| Storage | Git property files | Managed config service (Vault, AppConfig, LaunchDarkly) |
| Deployment | Bundled with app | Independent, hot-reloadable |
| Security | Plaintext in repo | Encryption, IAM, audit logs |
| Environments | Manual file separation | Automatic namespace isolation |
| Feature toggles | Hardcoded booleans | Dynamic rules with targeting |

## Old Code vs New Code in This Project

### Old (Buggy) Code

```typescript
// src/config.ts (as-is)
const store: Record<string, Record<string, any>> = {};

export function setConfig(app: string, env: string, config: any) {
  store[app] = { ...store[app], ...config };
}

export function getConfig(app: string, env: string) {
  return store[app] || {};
}
```

### New (Fixed) Code

```typescript
// src/config.ts (fixed)
const store: Record<string, Record<string, Record<string, any>>> = {};

export function setConfig(app: string, env: string, config: any) {
  if (!store[app]) {
    store[app] = {};
  }
  store[app][env] = { ...store[app][env], ...config };
}

export function getConfig(app: string, env: string) {
  return store[app]?.[env] ?? {};
}
```

**Key Differences:**
- Storage is now `store[app][env]` instead of `store[app]`.
- Merges only affect the target environment.
- Reads return the exact environment requested.
