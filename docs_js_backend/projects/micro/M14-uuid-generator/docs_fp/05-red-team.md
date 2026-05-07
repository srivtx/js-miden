# M14 UUID Generator: Red Team

## Attack Scenarios

Your UUID generator is a utility — until it becomes a weapon. Here is how an attacker exploits weak generation, weak validation, and UUID misuse.

---

## Attack 1: UUID Prediction (Seed Recovery)

### The Vector

The attacker discovers that your UUIDs are generated with `Math.random()`. They create 10 accounts and collect the session tokens.

### The Exploit

`Math.random()` uses a 128-bit xorshift128+ state. By observing a few outputs, an attacker can reconstruct the seed and predict all future values. They automate session hijacking by testing predicted tokens against authenticated endpoints.

```typescript
// Attacker's tool (conceptual)
const observedUUIDs = [...]; // 10 samples
const seed = recoverSeed(observedUUIDs); // ~2^64 operations, feasible with GPUs
for (let i = 0; i < 100000; i++) {
  const predictedToken = generateFromSeed(seed, i + 10);
  const res = await fetch('/api/account', { headers: { Authorization: predictedToken }});
  if (res.status === 200) console.log('HIJACKED:', predictedToken);
}
```

### The Defense

Use `crypto.randomUUID()` or `crypto.randomBytes(32)` for all security-sensitive identifiers. Never use `Math.random()` for tokens, sessions, or passwords.

---

## Attack 2: UUID Validation Bypass

### The Vector

Your API accepts UUIDs for resource lookup:

```typescript
app.get('/orders/:uuid', (req, res) => {
  if (!isValidUUID(req.params.uuid)) return res.status(400).send('Invalid UUID');
  // ... fetch order ...
});
```

But `isValidUUID` uses a permissive regex:

```typescript
const BUGGY_REGEX = /^[0-9a-f-]{36}$/i;
```

### The Exploit

The attacker provides:

```
GET /orders/'; DROP TABLE orders; --
```

Wait, that is 36 characters with hyphens? No. But what about:

```
GET /orders/550e8400-e29b-11d4-a716-446655440000
```

This is a UUID v1, not v4. If your database expects v4 but your validator accepts v1, an attacker can enumerate v1 timestamps to find when orders were created. Worse, if your SQL concatenates the UUID directly:

```typescript
const query = `SELECT * FROM orders WHERE uuid = '${req.params.uuid}'`;
```

A permissive regex that allows quotes or semicolons opens the door to SQL injection. (The strict v4 regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` prevents this because it only allows hex, hyphens, and the correct version/variant.)

### The Defense

Use the strict RFC 4122 regex that validates version, variant, and hex characters. Never concatenate UUIDs into SQL. Use parameterized queries.

---

## Attack 3: UUID Enumeration

### The Vector

Your API uses UUIDs as public resource identifiers:

```typescript
app.get('/invoices/:uuid', (req, res) => {
  const invoice = db.invoices.find(i => i.uuid === req.params.uuid);
  if (!invoice) return res.status(404).send('Not found');
  res.json(invoice);
});
```

### The Exploit

UUIDs are not credentials. They are identifiers. If your authorization check is missing or weak, an attacker can guess valid UUIDs and access other users' resources. While UUID v4 has 122 bits of entropy, making brute-force infeasible, information leakage can reduce the search space:

- **Timing attacks**: If `db.invoices.find()` takes longer for valid UUIDs than invalid ones, the attacker can distinguish valid from invalid.
- **Error messages**: If `404` takes 5 ms and `403` takes 50 ms, the attacker knows which UUIDs exist before they even try to bypass auth.
- **Bulk generation**: If the attacker can create resources themselves, they learn the generation pattern and can infer the approximate creation time of other resources.

### The Defense

1. **Always authorize before returning data**: Check that the authenticated user owns the resource.
2. **Use constant-time lookups**: Ensure database queries take the same time whether the UUID exists or not.
3. **Return generic errors**: `404 Not Found` for both missing and unauthorized resources.

---

## Red Team Summary

| Attack | Impact | Defense |
|--------|--------|---------|
| UUID Prediction | Session hijacking, account takeover | Use `crypto.randomUUID()`, never `Math.random()` |
| Validation Bypass | Data corruption, SQL injection | Strict regex + parameterized queries |
| UUID Enumeration | Unauthorized data access | Always authorize; constant-time lookups; generic errors |

## The Meta-Attack

The most dangerous attacker knows that UUIDs feel secure because they are long and random. But a UUID is not a permission. It is not a password. It is a name tag. If you rely on the unguessability of a name tag to protect your data, you have already lost.
