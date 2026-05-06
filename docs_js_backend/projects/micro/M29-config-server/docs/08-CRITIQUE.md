# 08-CRITIQUE: Config Server

## WHAT would a senior engineer say?

This project has a **fundamental architectural flaw**: it ignores the environment parameter in storage. This is not a minor bug; it is a design failure that makes the config server unsafe for any multi-environment deployment.

## WHY is this critique necessary?

Config servers hold the keys to the kingdom. If they are not architected with isolation and validation from day one, they become the weakest link in the security and reliability chain.

## HOW would a senior engineer fix this?

### 1. Fix Storage Hierarchy Immediately

**Current:** `store[app]` ignores `env`.
**Critique:** This is a P0 architectural bug.
**Fix:** Use `store[app][env]` and ensure merges only affect the target environment.

### 2. Replace Manual Validation with Schema Validation

**Current:** `validateConfig()` checks types but accepts negative numbers and invalid URLs.
**Critique:** Too permissive; will allow dangerous values into production.
**Fix:** Use Zod or JSON Schema with strict rules:

```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  dbHost: z.string().min(1),
  dbPort: z.number().int().min(1).max(65535),
  debug: z.boolean(),
  apiKey: z.string().min(16),
});
```

### 3. Add Access Control

**Current:** Anyone can write to any environment.
**Critique:** A compromised dev machine can overwrite prod.
**Fix:** Require authentication and authorization. Only `prod-deployer` role can write to `prod`.

### 4. Add Audit Logging

**Current:** No logs of config changes.
**Critique:** When prod breaks, you can't tell who changed what.
**Fix:** Log every `setConfig` with timestamp, user, app, env, and diff.

### 5. Add Versioning and Rollback

**Current:** Overwrites are destructive.
**Critique:** No way to recover from a bad change.
**Fix:** Store config history. Allow `GET /config/:app/:env/history` and `POST /config/:app/:env/rollback/:version`.

### 6. Encrypt Secrets

**Current:** API keys stored in plaintext in memory.
**Critique:** Memory dumps and core files leak secrets.
**Fix:** Integrate with HashiCorp Vault or AWS Secrets Manager for sensitive values.

### 7. Use a Production Config Platform

**Current:** Custom in-memory store.
**Critique:** Reinventing the wheel poorly.
**Fix:** For production, use Spring Cloud Config, AWS AppConfig, or LaunchDarkly.

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Senior Review) |
|--------|-----------------|-----------------------|
| Storage | `store[app]` flat | `store[app][env]` hierarchy |
| Validation | Manual type checks | Zod / JSON Schema |
| Access control | None | RBAC per environment |
| Audit logging | None | Every change logged |
| Versioning | None | Full history + rollback |
| Secrets | Plaintext in memory | Vault / KMS integration |
| Production platform | Custom code | Spring Cloud / AppConfig |

## ASCII Diagram: Production Config Server

```
Developer
    │
    │ POST /config/myapp/prod
    │ (JWT token with 'prod-deployer' role)
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Config Server (Production)                                  │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Auth       │  │  Validation │  │   Audit Log         │  │
│  │  (RBAC)     │  │  (Zod)      │  │   (immutable)       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         └─────────────────┴────────────────────┘              │
│                          │                                    │
│                   ┌──────┴──────┐                             │
│                   │   Storage   │                             │
│                   │   (Git /    │                             │
│                   │   Postgres) │                             │
│                   └──────┬──────┘                             │
└──────────────────────────┼────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
                Dev App      Prod App
```

## Final Verdict

**Grade: D for architecture, F for production safety.**

The REST API design is clean, but the storage model is catastrophically wrong. Fix the environment isolation, add schema validation, and then evaluate whether a custom config server is worth maintaining versus using a platform.
