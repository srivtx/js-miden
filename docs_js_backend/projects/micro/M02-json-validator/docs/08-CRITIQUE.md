# 08 — CRITIQUE: What a Senior Engineer Would Say

This section is a fictional but realistic code review from a staff engineer who has built and maintained APIs at scale.

---

## 1. "No Input Size Limits on express.json()"

**Current state:** `app.use(express.json());` with default settings.

**The criticism:** In production, you MUST set explicit limits:

```ts
app.use(express.json({ limit: '10kb', strict: true }));
```

- `limit: '10kb'` prevents a malicious client from sending a 100MB JSON payload that exhausts memory.
- `strict: true` (the default, but explicit is better) rejects primitive JSON values at the top level. A bare string `"evil"` as a request body is a known attack vector in some parsers.

**Real-world impact:** A single unbounded endpoint can crash an entire Node.js process with an out-of-memory error. Kubernetes restarts the pod, but if the attacker repeats the request, you get a restart loop.

---

## 2. "The Error Response Format is Not Versioned"

**Current state:**

```json
{
  "valid": false,
  "errors": [
    { "field": "name", "message": "String must contain at least 2 character(s)" }
  ]
}
```

**The criticism:** What happens when you need to add `errorCode` for i18n? Or `suggestion` for autocorrect? You break every client that parses this response.

**The fix:** Version your error contract or use an extensible envelope:

```json
{
  "apiVersion": "v1",
  "valid": false,
  "errors": [
    {
      "field": "name",
      "message": "String must contain at least 2 character(s)",
      "code": "string_too_small",
      "meta": { "min": 2 }
    }
  ]
}
```

**Educational gap:** Versioning is out of scope for a micro-project but is non-negotiable for public APIs.

---

## 3. "Zod Error Messages Are English-Only"

**Current state:** We return Zod's default error messages directly to the client.

**The criticism:** Zod messages are in English. A German user sees "String must contain at least 2 character(s)" instead of "Der Name muss mindestens 2 Zeichen enthalten."

**The fix:** Map Zod issues to translation keys:

```ts
const errorMap: Record<string, string> = {
  'string_too_small': 'validation.name_too_small',
  'invalid_email': 'validation.invalid_email',
};

const errors = result.error.errors.map((err) => ({
  field: err.path.join('.'),
  messageKey: errorMap[err.code] || 'validation.unknown',
  // Frontend translates messageKey using its i18n library
}));
```

**Educational gap:** i18n is a separate topic, but the student should know that raw Zod messages are not production-ready for global audiences.

---

## 4. "No Rate Limiting"

**Current state:** Anyone can hit `/validate` as fast as they want.

**The criticism:** Validation is CPU-cheap, but an attacker can still use this endpoint for:

- **Reconnaissance:** Sending thousands of payloads to probe validation rules.
- **Resource exhaustion:** If validation ever calls a database (e.g., `.refine(async () => ...)`), unbounded requests overwhelm the DB.

**The fix:** Add `express-rate-limit`:

```ts
import rateLimit from 'express-rate-limit';

app.use('/validate', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
}));
```

---

## 5. "No Request Logging"

**Current state:** The app does not log requests at all.

**The criticism:** In production, you cannot debug what you cannot see. Every API should log:

- Request method, path, and body (sanitized)
- Response status and duration
- Client IP and user agent

See M01 for a complete structured logging implementation.

---

## 6. "The Schema is Too Simple for Real Usage"

**Current state:** Three flat fields.

**The criticism:** Real-world schemas are nested, conditional, and contextual:

```ts
const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
  address: z.object({
    street: z.string(),
    city: z.string(),
    country: z.string().length(2), // ISO 3166-1 alpha-2
  }).optional(),
  newsletter: z.boolean().default(false),
}).refine((data) => {
  // If age < 21, country must not be 'US' (example business rule)
  return data.age >= 21 || data.address?.country !== 'US';
}, {
  message: 'Users under 21 cannot register from the US',
  path: ['address', 'country'],
});
```

**Educational gap:** This micro-project teaches the foundation. The student must practice with nested objects, arrays, unions (`z.union([...])`), and discriminated unions next.

---

## 7. "No OpenAPI / Swagger Documentation"

**Current state:** API behavior is documented only in READMEs and tests.

**The criticism:** Consumers of your API (frontend developers, mobile developers, external partners) need machine-readable documentation.

**The fix:** Use `@asteasolutions/zod-to-openapi` or `zod-openapi` to derive OpenAPI specs directly from Zod schemas:

```ts
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
extendZodWithOpenApi(z);

const userSchema = z.object({
  name: z.string().min(2).openapi({ example: 'Alice' }),
  email: z.string().email().openapi({ example: 'alice@example.com' }),
  age: z.number().int().min(18).openapi({ example: 25 }),
});
```

This generates an OpenAPI 3.0 spec that feeds into Swagger UI, Postman, or automated client generators.

---

## 8. "No graceful shutdown"

**Current state:** `src/index.ts` starts a server but does not handle SIGTERM.

**The criticism:** In Docker/Kubernetes, SIGTERM is the standard shutdown signal. Without handling it, in-flight requests are dropped.

**The fix:**

```ts
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server');
  server.close(() => {
    process.exit(0);
  });
});
```

See M01's `src/index.ts` for the complete pattern.

---

## Summary: Educational Gaps

This micro-project teaches validation fundamentals well but intentionally omits:

1. **Body parser limits** — prevents DoS via large payloads.
2. **API versioning** — required for evolving contracts.
3. **i18n of error messages** — required for global products.
4. **Rate limiting** — prevents abuse and reconnaissance.
5. **Request logging** — required for observability.
6. **Complex schemas** — nested objects, arrays, conditional validation.
7. **OpenAPI generation** — required for API discoverability.
8. **Graceful shutdown** — required for containerized deployments.

A senior engineer would approve of this as a **learning foundation** but would block it from production without at least #1, #4, and #5.
