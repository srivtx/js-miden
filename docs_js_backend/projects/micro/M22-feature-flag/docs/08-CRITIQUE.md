# CRITIQUE: Feature Flag

## Senior Engineer Review

### What's Missing

#### 1. No Persistence

**Current state:** Flags stored in-memory only.
**What's missing:** File or database persistence.

**Impact:** Restart the server = all flags reset. In production, this means:
- Rollouts restart from 0%
- New features are suddenly hidden
- Emergency kill switches don't work after restart

**Fix:**
```typescript
async save(): Promise<void> {
  await fs.writeFile(
    './flags.json',
    JSON.stringify(Array.from(this.flags.values()), null, 2)
  );
}

async load(): Promise<void> {
  try {
    const data = await fs.readFile('./flags.json', 'utf-8');
    const flags = JSON.parse(data);
    for (const flag of flags) {
      this.flags.set(flag.name, flag);
    }
  } catch { /* file doesn't exist yet */ }
}
```

#### 2. No Audit Trail

**Current state:** `setFlag()` overwrites with no history.
**What's missing:** Who changed what, when, and why.

**Impact:**
- Can't debug why a feature was disabled
- No compliance trail for regulated industries
- Can't undo accidental changes

#### 3. No Flag Expiration / Cleanup

**Current state:** Flags accumulate forever.
**What's missing:** Automatic removal of stale flags.

**Impact:** "Flag sprawl" - hundreds of dead flags in code, creating confusion and technical debt.

**Industry standard:** LaunchDarkly and Unleash both flag flags that haven't been modified in 30 days.

#### 4. No Multivariate Support

**Current state:** Boolean only (on/off).
**What's missing:** Multiple variants (A/B/C testing).

```typescript
// Missing:
const color = flags.getVariant('button-color', userId, ['red', 'green', 'blue']);
```

**Impact:** Can't run proper A/B tests with multiple variants.

#### 5. No Client-Side SDK

**Current state:** HTTP API only.
**What's missing:** Browser/edge SDK for zero-latency evaluation.

**Impact:** Every flag check requires a network round-trip.

### Security Concerns

#### 1. No Authentication on Admin Endpoints

```typescript
app.post('/flags/:flag', (req, res) => {
  // Anyone can create/modify flags!
  service.setFlag({ name: flag, enabled, rolloutPercentage, userIds });
});
```

**Risk:** An attacker could:
- Enable unfinished features
- Set rollout to 100% without testing
- Disable critical features (kill switches)

**Fix:** Add middleware:
```typescript
app.post('/flags/:flag', requireAdminAuth, (req, res) => {
  // ...
});
```

#### 2. User ID Enumeration

```typescript
app.get('/flags/:flag', (req, res) => {
  const userId = req.query.userId as string;
  // Different users get different results
});
```

**Risk:** An attacker could query many user IDs and build a map of who is in which experiment group.

**Mitigation:** This is usually acceptable for feature flags, but sensitive experiments should use server-side evaluation only.

#### 3. Information Leakage via Response

```typescript
res.json({
  flag,
  enabled,
  userId,
  rolloutPercentage: flagConfig?.rolloutPercentage ?? 0,
});
```

**Risk:** Exposing `rolloutPercentage` to all users leaks internal configuration.

**Fix:** Only return `enabled` boolean to clients. Keep configuration details internal.

#### 4. Regex Denial of Service (ReDoS) Potential

If user IDs are validated against regex:
```typescript
// Hypothetical:
if (!/^[a-z0-9]+$/.test(userId)) { ... }
```

**Risk:** Malicious regex can cause CPU exhaustion.

**Mitigation:** Use simple validation (length, alphanumeric) or no regex at all.

### Architecture Concerns

#### 1. Single Point of Failure

In-memory flags on a single instance. If the service restarts, flags are lost.

#### 2. No Caching Strategy

Every flag evaluation does a Map lookup. While fast, at massive scale with thousands of flags, caching frequently accessed flags would help.

#### 3. No Bulk Evaluation

```typescript
// Current: N API calls for N flags
for (const flag of flags) {
  await fetch(`/flags/${flag}?userId=${userId}`);
}

// Missing: Single call
await fetch(`/flags?userId=${userId}`); // Returns all flags
```

The `GET /flags` endpoint exists but should be the primary client interface.

#### 4. Test Reliance on Shared State

```typescript
beforeEach(() => {
  service.setFlag({ name: 'test-flag', enabled: true, rolloutPercentage: 50 });
});
```

Tests mutate shared global state. Better to create a fresh `FeatureFlagService` per test.

### Recommendations for Production

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Add authentication to admin endpoints | 1 day |
| P0 | Add persistence (file or Redis) | 1 day |
| P1 | Add audit log | 2 days |
| P1 | Hide internal config from API responses | 0.5 day |
| P2 | Add multivariate support | 3 days |
| P2 | Add flag expiration | 2 days |
| P2 | Create client-side SDK | 1 week |
