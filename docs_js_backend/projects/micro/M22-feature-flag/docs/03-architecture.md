# Architecture: Feature Flag

## Components

### FeatureFlag Model
- `name`: Flag identifier
- `enabled`: Global on/off switch
- `rolloutPercentage`: 0-100%
- `userIds`: Override list

### FeatureFlagService
- Stores flags in memory (Map)
- Evaluates flags for users
- Computes consistent hash for rollout

### Express Routes
- `GET /flags/:flag` - Evaluate single flag
- `GET /flags` - Evaluate all flags
- `POST /flags/:flag` - Update flag

## Evaluation Flow

1. Client requests `GET /flags/dark-mode?userId=abc123`
2. Service looks up flag
3. If flag doesn't exist → return false
4. If flag disabled → return false
5. If userId in override list → return override value
6. Compute hash(userId + flagName)
7. If hash % 100 <= rolloutPercentage → return true
8. Otherwise → return false

## Consistent Hashing

```
hash = sha256(userId + flagName)
value = parseInt(hash.slice(0, 8), 16) % 100
enabled = value < rolloutPercentage
```

This ensures the same user always gets the same result for the same flag.

## Persistence (Phase 2)

Flags should be stored in Redis/database with:
- TTL for temporary flags
- Versioning for rollbacks
- Audit log for changes
