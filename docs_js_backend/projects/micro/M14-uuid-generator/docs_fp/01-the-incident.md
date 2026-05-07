# M14 UUID Generator: The Incident

## 4:12 AM — The Authentication Pager

You are the on-call security engineer. Your phone erupts with a SEV-1 from the fraud team:

> **CRITICAL:** Mass account takeover in progress. 12,000 sessions hijacked in 3 hours. Pattern suggests predictable session tokens.

You pull the session token generation logs. They look normal at first:

```
2024-06-12T04:12:01Z session created: 550e8400-e29b-41d4-a716-446655440001
2024-06-12T04:12:02Z session created: 550e8400-e29b-41d4-a716-446655440002
2024-06-12T04:12:03Z session created: 550e8400-e29b-41d4-a716-446655440003
```

Wait. The UUIDs are sequential.

## The Smoking Gun

You grep the auth service codebase:

```typescript
function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

A contractor copy-pasted the top Stack Overflow answer for "JavaScript UUID generator." It uses `Math.random()`, which is **not cryptographically secure.** The seed is predictable.

## The Attack Reconstruction

The attacker did this:

1. **Create 10 accounts** over 2 days and collect their session tokens.
2. **Analyze the sequence** to reconstruct the `Math.random()` internal state (a 128-bit xorshift128+ seed).
3. **Predict the next 50,000 tokens** with 90% accuracy.
4. **Automate session hijacking** by brute-forcing predicted tokens against `/api/user/profile`.
5. **For each valid session**, transfer funds, change emails, and lock the real user out.

```
Attacker collects:
  token_1 = 550e8400-e29b-41d4-a716-446655440001
  token_2 = 550e8400-e29b-41d4-a716-446655440002
  token_3 = 550e8400-e29b-41d4-a716-446655440003

Attacker infers PRNG state → predicts:
  token_4 = 550e8400-e29b-41d4-a716-446655440004  ✓ VALID (hijacked)
  token_5 = 550e8400-e29b-41d4-a716-446655440005  ✓ VALID (hijacked)
  ...
```

## The Blast Radius

| Metric | Value |
|--------|-------|
| Hijacked sessions | 12,047 |
| Fraudulent transactions | $890,000 |
| Accounts with changed emails | 3,200 |
| Data export requests by attackers | 1,400 |

## The Fix (Hidden)

<details>
<summary>Click to reveal</summary>

1. **Immediately switch to `crypto.randomUUID()`**:
   ```typescript
   import { randomUUID } from 'node:crypto';

   function generateSessionToken(): string {
     return randomUUID();
   }
   ```

2. **Rotate all existing session tokens** forcefully:
   ```sql
   UPDATE sessions SET revoked = true WHERE created_at < NOW();
   ```

3. **Invalidate all active JWTs** by rotating the signing key.

4. **Add a security test** that asserts tokens are unpredictable:
   ```typescript
   it('should not generate sequential or predictable tokens', () => {
     const tokens = Array.from({ length: 1000 }, generateSessionToken);
     const prefixMatches = tokens.filter(t => t.startsWith(tokens[0].slice(0, 8)));
     expect(prefixMatches.length).toBeLessThan(5); // Birthday paradox allows ~1
   });
   ```

5. **Audit every use of `Math.random()` in the codebase** for security-sensitive contexts.

</details>

## Post-Incident Review

| Question | Answer |
|----------|--------|
| Why did this happen? | A contractor used `Math.random()` for security tokens, copy-pasting from Stack Overflow. |
| Why didn't tests catch it? | No test asserted unpredictability or checked for CSPRNG usage. |
| Why didn't code review catch it? | The function "looked like a UUID." Reviewers did not check the entropy source. |
| What architectural flaw? | Session tokens should use `crypto.randomBytes(32)`, not UUIDs at all. UUIDs are for resource IDs. |

## The Real Lesson

> **"Random" is not "secure."**
>
> `Math.random()` is fast. It is seeded. It is deterministic. It is designed for games, animations, and Monte Carlo simulations — not for cryptography. The difference between a PRNG and a CSPRNG is not performance. It is whether an attacker who knows the last 1,000 values can predict the next one.
>
> They can.

The most expensive copy-paste in history costs $890,000 and 12,000 breached accounts.
