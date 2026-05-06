# PROBLEM: Feature Flag

## WHAT We're Building

A feature flag service that determines whether a feature is enabled for a given user, supporting percentage-based rollouts, user-specific overrides, and consistent user assignment.

## WHY This Matters

Feature flags decouple deployment from release. Teams can push code to production hidden behind a flag, then gradually expose it to users. This enables:
- Gradual rollouts (10% → 50% → 100%)
- A/B testing and experimentation
- Instant rollbacks without redeployment
- Canary releases to production

Without feature flags, every release is an all-or-nothing gamble.

## Constraints

1. **Consistent Assignment**: Same user must always see the same feature state
2. **Percentage Rollouts**: Must support 0-100% gradual exposure
3. **User Overrides**: Specific users can be forced on/off regardless of percentage
4. **Disabled Flags**: A disabled flag returns false for all users
5. **Missing Flags**: A non-existent flag returns false
6. **No External Dependencies**: In-memory storage for this micro-project
7. **Performance**: Flag evaluation must be <1ms per request

## Real-World Context

Feature flags power LaunchDarkly ($3B valuation), Unleash (open source), Flagsmith, and internal systems at Facebook, Google, and Netflix. They are critical infrastructure for continuous deployment. A broken feature flag system can accidentally expose unfinished features or break A/B test validity.

## Success Criteria

- [ ] Non-existent flags return disabled
- [ ] Disabled flags return false for all users
- [ ] Same user always gets consistent result for same flag
- [ ] Percentage rollout works (e.g., 10% means ~10% of users)
- [ ] User-specific overrides bypass percentage logic
- [ ] All flag states are queryable via API
