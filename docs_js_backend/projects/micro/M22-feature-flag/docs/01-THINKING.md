# THINKING: Feature Flag

## Mental Models

### The Light Switch Model

A feature flag is like a light switch, but with a dimmer and key overrides:
- **OFF**: Switch is down, room is dark for everyone
- **DIMMER at 10%**: Room is lit for 10% of people
- **Master Key Override**: Specific people have a key that bypasses the dimmer

### The Airport Security Model

Think of percentage rollouts like TSA PreCheck:
- 10% of travelers randomly selected for PreCheck (rollout)
- But frequent flyers with Known Traveler Numbers always get it (user override)
- If PreCheck lanes are closed (flag disabled), no one gets it

The critical insight: **the same traveler must get the same result every time**. You can't have PreCheck on Monday and not on Tuesday for the same person.

### The Scientist Model

Feature flags are the foundation of A/B testing. You are a scientist:
- **Control group**: Flag is off
- **Treatment group**: Flag is on
- **Metric**: Conversion rate, engagement, revenue

If users switch between control and treatment randomly, your experiment is invalid. Consistency is scientific validity.

## Hot Path (What Happens on Every Request)

```
Request: GET /flags/dark-mode?userId=alice-123
    |
    v
[Look up flag] --missing?--> Return false
    |
    v
[Check enabled] --disabled?--> Return false
    |
    v
[Check user override] --in userIds?--> Return true
    |
    v
[Hash userId + flagName] --> [Map hash to 0-100]
    |
    v
[Compare to rolloutPercentage] --> Return true/false
```

The hot path is O(1). The hash computation is the most expensive operation and must be fast.

## Danger Zones

### 1. Random Assignment (Our Bug)

Using `Math.random()` means the same user gets different results on every request. This breaks:
- User experience (feature appears/disappears)
- A/B test validity
- Caching (different content for same user)

### 2. Hash Collisions

A poor hash function could assign the same bucket to many users, causing uneven distribution.

**Example:** `userId.length % 100` would mean all 3-character user IDs (e.g., "abc") get the same bucket.

**Mitigation:** Use cryptographic hash (SHA-256) of `userId + flagName`.

### 3. User ID Changes

If a user logs in/out, their ID changes. A logged-out user might see the feature, but after logging in, they might not.

**Mitigation:** Use stable identifiers (account ID, not session ID).

### 4. Flag Interactions

Two flags "new-checkout" and "dark-mode" might interact. A user in the treatment group for both could see an untested combination.

**Mitigation:** Use multivariate flags or flag dependency graphs.

### 5. Cold Start Problem

When a flag is first created, what percentage is correct? Starting at 100% risks exposing bugs. Starting at 0% means no data.

**Mitigation:** Start at 1% with internal users only, then expand.

## What-If Game

### What if we use Math.random()?

Users see flickering features. Analytics teams report "impossible" conversion rates. Product managers lose trust in A/B testing. This is our intentional bug.

### What if rolloutPercentage is 50% but we only have 2 users?

With consistent hashing, user A might always be enabled, user B always disabled. That's correct behavior for 50%. The "50%" refers to probability over a large population, not exact counts.

### What if a user is in the override list AND rollout is 0%?

Override should win. If an admin needs to test a feature, they shouldn't need to change the global rollout.

### What if the flag service goes down?

All flags should default to their "safe" state (typically off/false). Use local caching or default values.

### What if we need to rollout by geography, not user?

We'd need additional dimensions in the hash: `hash(userId + flagName + countryCode)`. Or use targeting rules instead of pure percentage.

### What if we have 1000 flags and 1M users?

In-memory storage becomes expensive. We need:
- Redis for flag definitions
- CDN for flag configurations (LaunchDarkly uses this)
- Client-side SDKs that download flag rules and evaluate locally
