# WHAT: Feature Flag

## Definition

A feature flag (or feature toggle) is a mechanism that allows developers to enable or disable features in production without deploying new code.

## Types of Feature Flags

### Release Flags
- Turn features on/off for everyone
- Used for gradual rollouts

### Experiment Flags (A/B Testing)
- Different experiences for different users
- Measure impact on metrics

### Ops Flags
- Kill switches for emergency rollback
- Circuit-breaker-like behavior

### Permission Flags
- User-specific access control
- Premium features

## Rollout Strategies

1. **All-or-Nothing**: 0% or 100%
2. **Percentage**: Gradual increase (1%, 5%, 10%, 50%, 100%)
3. **User Segments**: Target specific user groups
4. **Canary**: Small percentage first, then expand

## Key Metrics

- **Rollout Coverage**: % of users with feature enabled
- **Consistency**: Same user gets same result over time
- **Latency**: Flag evaluation time
- **Error Rate**: Flags causing errors
