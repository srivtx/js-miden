# WHY: Feature Flag

## The Problem

Traditional deployment requires releasing features to all users at once:
- Bugs affect 100% of users
- Rollbacks require new deployments
- A/B testing requires separate code paths
- Can't gradually validate new features

## Why Feature Flags Help

### 1. Gradual Rollouts
Release to 1% of users, monitor metrics, then expand to 100%. If issues arise, disable instantly without deployment.

### 2. A/B Testing
Show version A to 50% of users and version B to 50%. Measure conversion, engagement, or revenue differences.

### 3. Emergency Rollback
If a feature causes issues, toggle it off in seconds rather than waiting for a deployment rollback.

### 4. Trunk-Based Development
Developers merge to main frequently without affecting users. Features are hidden behind flags until ready.

### 5. Targeted Releases
Release to beta users, internal employees, or specific regions first.

## Without Feature Flags

```
Deploy v2.0 with new checkout → Bug affects all users
→ Emergency rollback deployment
→ 30 minutes of downtime
→ All users impacted
```

## With Feature Flags

```
Deploy v2.0 with new checkout (flagged)
→ Enable for 5% of users
→ Monitor error rate
→ Bug detected! Disable flag
→ 0 users impacted
→ Fix bug, re-enable gradually
```

## Business Impact

- **Risk Reduction**: Smaller blast radius for bugs
- **Velocity**: Deploy daily without fear
- **Experimentation**: Data-driven feature decisions
- **Operational Safety**: Instant rollback capability
