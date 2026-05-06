# Overview: Feature Flag

Feature flags (feature toggles) enable teams to deploy code to production without releasing features to all users. They support gradual rollouts, A/B testing, and emergency rollbacks.

## Project Goal

Build a feature flag service that determines whether a feature is enabled for a given user, supporting percentage-based rollouts and user-specific overrides.

## Learning Outcomes

After completing this project, you will understand:
- Consistent hashing for deterministic user assignment
- Percentage-based rollout calculations
- Flag evaluation performance
- A/B testing foundations
- Persistence strategies for flag state

## Real-World Context

Feature flags power LaunchDarkly, Unleash, Flagsmith, and internal systems at companies like Facebook and Google. They are critical for continuous deployment and experimentation.

## File Structure

```
src/
  index.ts           - Express server
  feature-flag.ts    - Core feature flag service
tests/
  feature-flag.test.ts - Test suite
docs/
  01-overview.md
  02-requirements.md
  03-architecture.md
  04-what.md
  05-why.md
  06-how.md
  07-wrong-vs-right.md
  08-testing.md
  09-bugs.md
```
