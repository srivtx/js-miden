# 01 — THINKING: Mental Models for Validation

## The Hot Path

```
Client
  │
  │ POST /validate
  │ { "name": "Alice", "email": "alice@example.com", "age": 25 }
  ▼
Express ──express.json()──> req.body = parsed JSON object
  │
  ▼
Zod schema.safeParse(req.body)
  │
  ├─> Valid? ──yes──> result.data (stripped, typed)
  │                     │
  │                     ▼
  │                  res.status(200).json({ valid: true, data })
  │
  └─> Invalid? ──no──> result.error.errors (array of issues)
                        │
                        ▼
                     res.status(400).json({ valid: false, errors })
```

**The hot path is: parse body → validate → branch → respond.**

Any delay in validation delays the response. Zod is fast enough that validation time is negligible (<0.1ms for simple schemas).

## Mental Model 1: The Compile-Time vs Runtime Gap

TypeScript gives you **compile-time** types. Zod gives you **runtime** validation. These are NOT the same thing.

```
Compile time (TypeScript):
  function saveUser(user: User) { ... }
  // TypeScript ensures ONLY correct User objects reach this function
  // ...but only at compile time. At runtime, TypeScript disappears.

Runtime (Zod):
  const result = userSchema.safeParse(unknownData);
  if (result.success) {
    saveUser(result.data); // Guaranteed to match User at runtime
  }
```

**The gap:** TypeScript types are erased during compilation. A malicious client can send ANY JSON. Without runtime validation, your "typed" function receives garbage and crashes.

```ts
// TypeScript thinks this is safe:
app.post('/user', (req, res) => {
  const user: User = req.body; // LIE. req.body is `any`.
  saveUser(user); // Could crash if req.body is malformed.
});
```

Zod closes the gap by validating at the boundary (HTTP request) before the data reaches your business logic.

## Mental Model 2: Strict vs Permissive APIs

There are two philosophies for handling unexpected input:

**Permissive (Postel's Law):**
> "Be conservative in what you send, be liberal in what you accept."

- Coerce `"25"` to `25`.
- Ignore unknown fields silently.
- Accept `name: null` and replace with `""`.

**Strict (Fail Fast):**
> "Reject anything that doesn't match the contract exactly."

- `"25"` fails validation (wrong type).
- Unknown fields are stripped or rejected.
- `name: null` fails validation (not a string).

**We choose strict.**

Why? Because permissive APIs create hidden bugs. If a client sends `"25"` and you coerce it, the client never fixes their code. Six months later, a different endpoint DOESN'T coerce, and the same client breaks. Strict APIs surface bugs immediately.

## Mental Model 3: Parsing vs Validating

Zod's method is called `safeParse`, not `safeValidate`. This is intentional.

- **Validate:** Check if input matches rules. Return boolean.
- **Parse:** Check rules AND return transformed/cleaned data.

```ts
const result = userSchema.safeParse({
  name: 'Alice',
  email: 'alice@example.com',
  age: 25,
  role: 'admin', // unknown field
});

// result.data does NOT contain 'role'
// Zod STRIPPED it during parsing
```

Parsing is more powerful than validation because it gives you clean data.

## Question Everything

### Q: Why not use TypeScript's `as` keyword?

```ts
const user = req.body as User;
```

Because `as` is a **type assertion**, not validation. It tells TypeScript "trust me, this is a User." It does NOTHING at runtime. If `req.body` is `{ name: 123 }`, TypeScript believes it's a User, and your code crashes.

### Q: Why not use JSON Schema?

JSON Schema is a standard (IETF RFC). It's powerful and language-agnostic. But:

- It's verbose. A Zod schema is 5 lines; the equivalent JSON Schema is 30.
- It requires a separate type definition. Zod infers types automatically.
- It has no TypeScript integration. You maintain schema and types separately.

For Node.js/TypeScript services, Zod is the pragmatic choice. For cross-language APIs (Java backend, TypeScript frontend), JSON Schema or OpenAPI is better.

### Q: What if the schema needs to change?

Version your API. `POST /v1/validate` and `POST /v2/validate` can have different schemas. Never break existing clients by changing validation rules on a live endpoint.

## The What-If Game

### What if someone sends a 100MB JSON payload?

- `express.json()` has a default limit of 100KB. The request would be rejected with `413 Payload Too Large`.
- If you increase the limit, you risk memory exhaustion. Always set `express.json({ limit: '10kb' })` for APIs that expect small payloads.

### What if someone sends circular JSON?

- `JSON.parse` throws on circular references before Express even sees the body.
- If you construct objects programmatically (e.g., `JSON.stringify(req.body)`), circular refs throw. Zod never sees them.

### What if the client sends `age: NaN`?

- `NaN` is technically a `number` in JavaScript. Zod's `z.number()` accepts it!
- To reject `NaN`, you'd need `.refine((n) => !Number.isNaN(n))`.
- This is a subtle JavaScript gotcha. `typeof NaN === 'number'` is true.

### What if we need nested validation?

```ts
const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
});

const userSchema = z.object({
  name: z.string(),
  address: addressSchema, // Nested schema
});
```

Zod composes naturally. Small schemas build big ones.

### What if we need async validation?

```ts
const userSchema = z.object({
  email: z.string().email().refine(async (email) => {
    const exists = await db.userExists(email);
    return !exists;
  }, { message: 'Email already registered' }),
});
```

Use `.safeParseAsync()` instead of `.safeParse()` for async refinements.
