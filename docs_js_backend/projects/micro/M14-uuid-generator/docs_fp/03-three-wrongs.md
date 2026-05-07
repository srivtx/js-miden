# M14 UUID Generator: Three Wrongs

Below are three plausible but broken implementations of UUID generation and validation. Each looks reasonable on the surface. Each will fail in production.

---

## Wrong #1: Math.random()

```typescript
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

### Why It Looks Right
It is the top Stack Overflow answer. It works in browsers. It is fast. It produces strings that look like UUIDs.

### Why It Destroys You
`Math.random()` is a seeded PRNG. An attacker who observes a few UUIDs can reconstruct the seed and predict future values. If these UUIDs are used as session tokens, resource IDs, or reset tokens, the attacker can hijack sessions, enumerate resources, and bypass authentication.

**The failure mode**: A pen tester generates 10 UUIDs, runs them through a seed-recovery tool, and predicts the next 1,000 tokens with 85% accuracy. Every session is compromised.

---

## Wrong #2: Permissive Validation

```typescript
function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(uuid);
}
```

### Why It Looks Right
It is simple. It accepts anything that looks like a UUID. It seems sufficient for input validation.

### Why It Destroys You
1. **Invalid hex**: `gggggggg-gggg-gggg-gggg-gggggggggggg` passes.
2. **Wrong version**: A UUID v1 (timestamp-based) passes even if your system expects v4.
3. **Wrong variant**: A Microsoft GUID variant passes even if your system expects RFC 4122.
4. **Database corruption**: Invalid UUIDs slip into your database and cause index corruption or query failures later.

**The failure mode**: An attacker provides `550e8400-e29b-11d4-a716-446655440000` (v1) where v4 is expected. Your system accepts it. Six months later, a migration script assumes all UUIDs are v4 and fails catastrophically.

---

## Wrong #3: Using UUIDs as Session Tokens

```typescript
app.post('/login', (req, res) => {
  const user = authenticate(req.body);
  const sessionToken = generateUUID(); // v4, CSPRNG-based
  res.cookie('session', sessionToken);
  res.json({ success: true });
});
```

### Why It Looks Right
UUIDs are random. They are unique. They are standard. Why not use them as session tokens?

### Why It Destroys You
1. **No expiration metadata**: A UUID is just a string. It does not encode expiry, issuer, or scope. You must query the database on every request.
2. **Length**: 36 characters is 288 bits of payload. A JWT or random byte token is 32 bytes (256 bits) and carries claims.
3. **Entropy**: UUID v4 has 122 random bits. A secure session token should have 256 bits (`crypto.randomBytes(32)`).
4. **Predictability is relative**: Even with `crypto.randomUUID()`, UUIDs are designed for uniqueness, not for resisting brute-force guessing over time.

**The failure mode**: An attacker brute-forces session tokens. With 122 bits, it is hard — but not as hard as 256 bits. Meanwhile, your database is queried on every request because the token carries no metadata.

---

## The Pattern

| Wrong | Surface Appeal | Hidden Failure |
|-------|---------------|----------------|
| Math.random() | Fast, zero deps, browser-compatible | Predictable, seed-recoverable, session hijacking |
| Permissive regex | Simple, forgiving | Invalid hex, wrong version/variant, data corruption |
| UUID as session token | Standard, unique, random | No metadata, insufficient entropy, database overhead |

The correct solution requires: a CSPRNG for generation, a strict regex for validation, and `crypto.randomBytes(32)` for anything security-sensitive like session tokens.
