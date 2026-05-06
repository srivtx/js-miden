# 02 — DECISIONS: Architecture Choices with Alternatives

Every decision follows the format: **Option A** | **Option B** | **Chosen** | **Why** | **What if we're wrong?**

---

## Decision 1: Validation Library

**Option A: Joi**
- Created by the Hapi.js team. Mature, battle-tested, widely used.
- Powerful validation API: `.string()`, `.email()`, `.min()`, `.max()`.
- Requires `@types/joi` or `joi@17` for TypeScript support.
- **Does not infer types.** You write a Joi schema AND a TypeScript interface separately.

**Option B: Zod**
- Created by Colin McDonnell. TypeScript-native from the ground up.
- `z.infer<typeof schema>` generates TypeScript types automatically.
- Smaller bundle size than Joi.
- Faster development velocity due to single source of truth.

**Option C: Yup**
- Popular in frontend (React Formik).
- Similar API to Joi.
- **Does not infer types as cleanly as Zod.**
- Better for client-side form validation than backend APIs.

**Option D: JSON Schema + ajv**
- IETF standard. Language-agnostic.
- `ajv` is the fastest JSON Schema validator.
- Requires maintaining separate `.json` schema files and TypeScript interfaces.
- Verbose and repetitive for simple schemas.

**Chosen: Zod**

**Why:** The single source of truth is the killer feature. One schema definition gives you runtime validation, TypeScript types, and IntelliSense. For a TypeScript backend, anything else is duplication.

**What if we're wrong?**
- If the team later needs to share schemas with a Python or Go service, Zod is Node-only. We'd need to rewrite schemas in JSON Schema or Protocol Buffers. For cross-language contracts, OpenAPI or Protobuf is better.
- Zod's error messages are good but not infinitely customizable. For complex i18n requirements, Joi's `.messages()` API is more flexible.

---

## Decision 2: Strictness Mode

**Option A: Coerce types**

```ts
const schema = z.object({
  age: z.coerce.number(), // "25" → 25, true → 1
});
```

- Accepts more input shapes. Fewer 400 errors for clients.
- Postel's Law: be liberal in what you accept.

**Option B: Strict types (no coercion)**

```ts
const schema = z.object({
  age: z.number(), // "25" → validation error
});
```

- Rejects type mismatches immediately.
- Surfaces client bugs early.
- Prevents hidden coercion bugs (e.g., `null` coercing to `0`).

**Chosen: Strict**

**Why:** In a public API, coercion masks client bugs. If a frontend sends `"25"` instead of `25`, the backend should reject it so the frontend team fixes their serialization. Silent fixes create technical debt across teams.

**What if we're wrong?**
- If the API is consumed by legacy systems that can't send proper types (e.g., HTML forms where everything is a string), strict mode breaks them. In that case, `.coerce` or a dedicated form parser is necessary.

---

## Decision 3: Unknown Field Handling

**Option A: Pass through (`passthrough()`)**

```ts
z.object({ name: z.string() }).passthrough();
// Input: { name: "Alice", role: "admin" }
// Output: { name: "Alice", role: "admin" }
```

- Preserves all client data.
- Useful for APIs that proxy data to flexible backends (MongoDB, Elasticsearch).

**Option B: Strip unknown (default)**

```ts
z.object({ name: z.string() });
// Input: { name: "Alice", role: "admin" }
// Output: { name: "Alice" }
```

- Removes unexpected fields.
- Prevents injection of fields that downstream systems might misinterpret.
- Safer for strict relational databases.

**Option C: Strict (reject unknown)**

```ts
z.object({ name: z.string() }).strict();
// Input: { name: "Alice", role: "admin" }
// Result: Validation error — "Unrecognized key(s) in object: 'role'"
```

- Explicitly rejects unknown fields.
- Best for APIs where the contract must be exact.

**Chosen: Strip (default behavior)**

**Why:** Stripping is the middle ground. It doesn't break clients that send extra metadata (e.g., a frontend framework adding `_csrf` tokens), but it prevents that data from reaching business logic. For public APIs, `strict()` is often too aggressive.

**What if we're wrong?**
- If a client depends on echo-back of unknown fields (e.g., a generic form builder), stripping silently loses data. The client gets a 200 but their data disappeared. In that case, `passthrough()` or `strict()` is better depending on the use case.

---

## Decision 4: Error Response Format

**Option A: Zod's raw error format**

```json
{
  "valid": false,
  "errors": [
    {
      "code": "too_small",
      "minimum": 2,
      "type": "string",
      "inclusive": true,
      "message": "String must contain at least 2 character(s)",
      "path": ["name"]
    }
  ]
}
```

- Complete information.
- Exposes internal Zod implementation details (`code`, `inclusive`).
- Frontend must parse Zod-specific structures.

**Option B: Custom simplified format**

```json
{
  "valid": false,
  "errors": [
    { "field": "name", "message": "String must contain at least 2 character(s)" }
  ]
}
```

- Clean, stable contract.
- Frontend-friendly.
- Hides implementation details.

**Chosen: Option B**

**Why:** API contracts should be implementation-agnostic. If we later switch from Zod to Joi, the error response format should not change. Our custom mapping creates a stable contract.

**What if we're wrong?**
- If a frontend needs the raw Zod metadata (e.g., to render a dynamic error message with the exact minimum length), the simplified format loses that data. We could add an optional `meta` field for advanced clients.

---

## Decision 5: Module System

**Option A: CommonJS**
- `require()` / `module.exports`.
- Works everywhere.

**Option B: ESM**
- `import` / `export`.
- Native top-level await.
- Tree-shaking support.
- Required by some modern packages.

**Chosen: ESM**

**Why:** Same rationale as M01. ESM is the standard for new Node.js projects in 2025. Zod itself ships as ESM with CJS fallback.

**What if we're wrong?**
- Some deployment environments (AWS Lambda with certain bundlers) have edge cases with ESM. But Node.js 20 on Lambda supports ESM natively.

---

## Decision 6: Test Strategy

**Option A: Test only the API layer (integration tests)**
- Send HTTP requests, assert on status codes and response bodies.
- Validates the entire stack: Express routing, JSON parsing, Zod validation, response formatting.

**Option B: Test only the validation layer (unit tests)**
- Import `userSchema` directly.
- Call `userSchema.safeParse()` with various inputs.
- Fast, isolated, no HTTP overhead.

**Option C: Both**
- Unit tests for schema edge cases (e.g., `NaN`, `Infinity`, empty strings).
- Integration tests for the HTTP contract (status codes, headers, response shape).

**Chosen: Option C**

**Why:** Unit tests are fast and exhaustive. Integration tests catch wiring mistakes (e.g., forgetting `express.json()`). Together they provide confidence.

**What if we're wrong?**
- More tests = more maintenance. But for a micro-project, the test count is small. In a large codebase, we'd use property-based testing (fast-check) to generate thousands of random inputs automatically.

---

## Decision 7: Body Parser Configuration

**Option A: `express.json()` with defaults**

```ts
app.use(express.json());
```

- Default limit: 100KB.
- Default strict: true (only accepts arrays and objects).

**Option B: Custom limits**

```ts
app.use(express.json({ limit: '10kb', strict: true }));
```

- Explicit limits prevent denial-of-service via large payloads.
- `strict: true` rejects bare strings/numbers as top-level JSON (a security best practice).

**Chosen: Option A for this project, Option B for production**

**Why:** This is a learning project. We keep it simple. In production, ALWAYS set explicit limits.

**What if we're wrong?**
- A malicious client sends a 50MB JSON payload. Without a limit, `express.json()` buffers it in memory, potentially crashing the process with an out-of-memory error.
