# 06 — BUGS: The Intentional `.passthrough()` Bug

This project contains exactly one intentional bug. It is subtle, security-relevant, and teaches a fundamental lesson about API contract discipline.

---

## The Bug: `.passthrough()` Allows Unknown Fields

### Location

`src/validation.ts`, line 7:

```ts
export const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
}).passthrough(); // ← BUG
```

### Why It Exists

This bug is intentionally placed to demonstrate a security-critical mistake in schema design. The `.passthrough()` modifier tells Zod: "accept and return any keys that are NOT defined in the schema." This violates our Phase 3 decision to strip unknown fields for security.

### The Symptom

Run `npm test`:

```
FAIL  tests/validation.test.ts > POST /validate > strips unknown fields (security)
AssertionError: expected { name: 'Alice', …, role: 'admin' } not to have property 'role'
```

The response body contains `role: "admin"` even though `role` is not in the schema.

### Reproduction

The test that catches it sends an extra field and asserts it is removed:

```ts
it('strips unknown fields (security)', async () => {
  const res = await request(app)
    .post('/validate')
    .send({
      name: 'Alice',
      email: 'alice@example.com',
      age: 25,
      role: 'admin',  // ← Not in the schema
    });

  expect(res.status).toBe(200);
  expect(res.body.data).not.toHaveProperty('role');  // FAILS
});
```

With `.passthrough()`, Zod includes `role` in `result.data`. The test fails.

### Why This Is Dangerous in Production

Unknown fields are a **mass amplification attack vector**. Here's how:

#### Scenario 1: Mass Assignment

Your API validates user input, then passes it to a database ORM:

```ts
// Without stripping:
const result = userSchema.passthrough().safeParse(req.body);
if (result.success) {
  await db.users.create(result.data);
  // If req.body contains `isAdmin: true`, the user becomes an admin.
}
```

This is the classic **mass assignment vulnerability** that has compromised GitHub, Shopify, and countless Rails applications.

#### Scenario 2: Downstream Poisoning

Your API forwards validated data to a third-party service:

```ts
const result = userSchema.passthrough().safeParse(req.body);
await paymentGateway.createCustomer(result.data);
// If req.body contains `currency: 'USD', amount: 0`, the gateway might misinterpret it.
```

#### Scenario 3: Log Injection

Extra fields bloat your logs:

```ts
logger.info(result.data);
// If req.body contains a 10MB string under an unknown key, your log stream explodes.
```

### The Fix

Remove `.passthrough()`. Zod's default behavior for `z.object()` is to **strip** unknown keys, which matches our security decision.

```ts
export const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
}); // ← CORRECT: unknown keys are stripped automatically
```

### Why the Fix Works

Zod's `z.object()` has three modes for unknown keys:

| Mode | Method | Behavior |
|------|--------|----------|
| Strip (default) | `z.object({})` | Removes unknown keys from output |
| Passthrough | `z.object({}).passthrough()` | Preserves unknown keys in output |
| Strict | `z.object({}).strict()` | Throws validation error on unknown keys |

Our security requirement is: "don't let unexpected data reach business logic." Strip mode achieves this silently and safely.

### Real-World Impact

| Incident | Cause | Impact |
|----------|-------|--------|
| GitHub 2012 | Mass assignment via `public_key` param | User gained admin access to Rails repo |
| Shopify 2022 | Unvalidated nested params | Users could modify other shop's settings |
| Generic MongoDB apps | No schema validation | `req.body` passed directly to `db.collection.insert()` |

Every major framework (Rails, Django, Laravel, Express) has shipped mass-assignment protections because this bug class is so common. Zod's default strip mode is your protection in the TypeScript/Node ecosystem.

### Prevention

1. **Default to strip or strict.** Never use `passthrough()` unless you have an explicit, documented reason.
2. **Audit your schemas.** Search for `.passthrough()` in code reviews. Treat it like `eval()` — suspicious by default.
3. **Test for unknown fields.** Every validation test suite should include a case that sends extra fields and asserts they disappear.
4. **Use an ORM with allowlists.** Even with Zod stripping, your ORM should also have an explicit field allowlist (e.g., Prisma's `select`, TypeORM's `@Column()`).
5. **Layer defenses.** Validation + ORM allowlist + database permissions. No single layer is enough.

---

## Bonus: Why Zod Defaults to Strip

Zod's creator, Colin McDonnell, chose strip as the default because:

> "In most applications, extra keys are a mistake or an attack. Preserving them by default would silently allow mass assignment bugs. Stripping is the safer default."

This is an example of **secure by default** design. The dangerous option (`passthrough`) requires explicit opt-in.
