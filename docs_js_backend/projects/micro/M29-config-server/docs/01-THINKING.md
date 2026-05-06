# 01-THINKING: Config Server

## WHAT is the mental model?

A Config Server is a **key-value store with dimensions**. The key is not just `app`; it is `app × env × key`. Every write and read must include the full coordinate tuple. The core principle is: **dev can never touch prod**.

## WHY does this mindset matter?

Configuration is code that doesn't go through a compiler. A typo in a config file can take down a production system faster than a code bug. Environment isolation is the **minimum viable safety measure** for any config system.

## HOW do we reason about config server design?

### The Config Coordinate System

1. **App dimension**: `myapp`, `payments`, `auth-service`
2. **Environment dimension**: `dev`, `staging`, `prod`, `canary`
3. **Key dimension**: `dbHost`, `apiKey`, `featureFlags`
4. **Operation**: `setConfig(app, env, key, value)` and `getConfig(app, env)`

```
                    dev       staging      prod
                  ┌─────┐    ┌─────┐    ┌─────┐
         myapp    │ A-d │    │ A-s │    │ A-p │
                  └─────┘    └─────┘    └─────┘
                  ┌─────┐    ┌─────┐    ┌─────┐
        payments  │ P-d │    │ P-s │    │ P-p │
                  └─────┘    └─────┘    └─────┘
```

### Validation Layers

1. **Schema validation**: Reject configs that don't match expected types.
2. **Environment validation**: Reject writes to `prod` from untrusted clients.
3. **Audit logging**: Log every change with user, timestamp, and diff.

## WRONG vs RIGHT Thinking

| WRONG Mindset | RIGHT Mindset |
|---------------|---------------|
| "Config is just JSON; store it flat." | "Config is a multi-dimensional namespace." |
| "We'll be careful not to overwrite prod." | "The system must enforce isolation; humans are not careful." |
| "One store per app is enough." | "Every environment needs its own independent store slice." |
| "Validation is overhead." | "Validation prevents the most expensive outages." |

## Decision Checklist

- [ ] Is the storage key multi-dimensional (`app × env`)?
- [ ] Is there schema validation before storing?
- [ ] Is there access control per environment?
- [ ] Is every change audited?
- [ ] Can configs be versioned and rolled back?
