# M22: Feature Flag

A feature flag system with user-based rollout and intentional bugs to fix.

## Quick Start

```bash
npm install
npm test          # See failing tests
npm run build
npm start
```

## API

- `GET /flags/:flag` - Check if flag is enabled for user
- `GET /flags` - Get all flags for a user
- `POST /flags/:flag` - Create/update a flag

## Phases

### Phase 1: Basic Feature Flags
Build a system that:
- Returns enabled/disabled per flag
- Supports user-based rollout (10% of users)
- Supports gradual percentage rollout
- Allows user-specific overrides

### Phase 2-3: Advanced Concepts
- Consistent hashing (same user always gets same result)
- Percentage calculation accuracy
- A/B testing foundation
- Flag persistence
- Performance at scale

## Bugs

### Bug 1: Random Rollout
Uses `Math.random()` instead of consistent hashing, so the same user gets different results on every request.

### Bug 2: No Persistence
Flags are stored in memory and reset on server restart.

## Docs

See the `docs/` folder for complete documentation.
