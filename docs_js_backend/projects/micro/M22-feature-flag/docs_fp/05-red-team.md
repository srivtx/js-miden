# Red Team: Exploiting Feature Flags

---

## Attack 1: Enumeration

**Payload:** Try different user IDs until you find one in the desired bucket.

**Impact:** Bypass A/B test, access unreleased features.

---

## Attack 2: Cookie Manipulation

**Payload:** Change feature flag cookie to enable beta features.

**Impact:** Access unfinished, potentially dangerous features.

---

## Attack 3: Targeted Rollout Bypass

**Payload:** Feature is rolled out to 10% of users. Guess hash inputs to get into the 10%.

**Impact:** Early access to features, potential security issues.
