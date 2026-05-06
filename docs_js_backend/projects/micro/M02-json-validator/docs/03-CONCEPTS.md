# 03 — CONCEPTS: Deep Explanations

---

## 1. Zod

### WHAT is it?

Zod is a TypeScript-first schema validation library. You write a schema using Zod's builder API, and Zod gives you two things:

1. **Runtime validation:** Check if unknown data matches the schema.
2. **Type inference:** Derive a TypeScript type from the schema automatically.

### WHY do we use it?

Because TypeScript types disappear at runtime. Zod bridges the gap between compile-time safety and runtime reality.

```ts
// TypeScript alone (compile-time only)
interface User {
  name: string;
  email: string;
  age: number;
}

const user = req.body as User; // LIE. No runtime check.

// Zod (compile-time + runtime)
const userSchema = z.object({ ... });
type User = z.infer<typeof userSchema>; // Same type, but now VALIDATED
const result = userSchema.safeParse(req.body);
if (result.success) {
  const user = result.data; // Truly a User at runtime
}
```

### HOW does it work?

Zod schemas are objects with a `.parse()` and `.safeParse()` method. When you call `.safeParse(input)`, Zod walks the schema tree and checks every field.

```
Input: { name: "Alice", email: "alice@example.com", age: 25 }

z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
})

Walkthrough:
  name: "Alice"
    └─> z.string() ✓
    └─> .min(2) ✓ (5 >= 2)
    └─> .max(50) ✓ (5 <= 50)

  email: "alice@example.com"
    └─> z.string() ✓
    └─> .email() ✓ (matches email regex)

  age: 25
    └─> z.number() ✓
    └─> .int() ✓ (25 is integer)
    └─> .min(18) ✓ (25 >= 18)
    └─> .max(120) ✓ (25 <= 120)

Result: { success: true, data: { name, email, age } }
```

### WRONG way vs RIGHT way

```ts
// WRONG: Type assertion (no validation)
const user = req.body as User;
saveUser(user); // Crashes if req.body is wrong

// WRONG: Manual validation (verbose, error-prone)
if (!req.body.name || typeof req.body.name !== 'string') {
  return res.status(400).json({ error: 'bad name' });
}
// ... 20 more lines of manual checks ...

// RIGHT: Schema validation
const result = userSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.errors });
}
saveUser(result.data); // Guaranteed correct
```

### Related concepts

- **`.parse()` vs `.safeParse()`:** `.parse()` throws on invalid data. `.safeParse()` returns a discriminated union `{ success: true, data: T } | { success: false, error: ZodError }`. Always use `.safeParse()` in HTTP handlers so you can return 400 instead of crashing.
- **`.refine()`:** Add custom validation logic beyond built-in checks.
- **`.transform()`:** Modify data during parsing (e.g., trim strings, lowercase emails).

---

## 2. Runtime Validation

### WHAT is it?

Checking the shape, type, and constraints of data while the program is running.

### WHY do we use it?

Because the outside world is untrusted. HTTP requests, file uploads, environment variables, and database results can contain ANYTHING. Runtime validation is the gatekeeper that prevents garbage from entering your business logic.

### HOW does it work?

At the boundary of your system (HTTP handler, file reader, CLI argument parser), you validate inputs before they propagate inward.

```
Untrusted Input
      │
      ▼
  [ VALIDATOR ]
      │
   ┌──┴──┐
   │     │
  ✓     ✗
   │     │
   ▼     ▼
Trusted   Reject
```

### WRONG way vs RIGHT way

```ts
// WRONG: Trusting input because TypeScript says it's fine
function processPayment(body: PaymentBody) {
  chargeCard(body.cardNumber, body.amount);
}
// A malicious client sends { cardNumber: "stolen", amount: -1000 }
// TypeScript can't stop this at runtime.

// WRONG: Validating deep inside business logic
function saveUser(user: User) {
  if (!user.email.includes('@')) {  // Too late!
    throw new Error('bad email');
  }
  db.insert(user);
}

// RIGHT: Validate at the boundary
app.post('/pay', (req, res) => {
  const result = paymentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  processPayment(result.data); // Safe to trust
});
```

### Related concepts

- **Input sanitization:** Removing dangerous characters (e.g., `<script>`) from strings. Validation checks shape; sanitization cleans content. Both are needed for security.
- **Contract testing:** Validating that your API responses match what consumers expect (e.g., Pact, OpenAPI validation).

---

## 3. TypeScript Types vs Runtime Types

### WHAT is it?

TypeScript has **compile-time types** (erased before running). JavaScript has **runtime values** (no inherent type system). They exist in different dimensions.

### WHY does the gap matter?

TypeScript makes you feel safe:

```ts
function greet(user: User) {
  console.log(user.name.toUpperCase());
}
```

But at runtime, `user` might be `undefined`. TypeScript cannot protect you from malicious HTTP requests, corrupted files, or database rows with nulls where none were expected.

### HOW does the gap manifest?

```ts
// Compile time: TypeScript is happy
const user: User = JSON.parse('{"name": 123}');
// No error! JSON.parse returns `any`, which is assignable to anything.

greet(user); // Runtime crash: 123.toUpperCase is not a function
```

### WRONG way vs RIGHT way

```ts
// WRONG: Type assertion on untrusted data
const user = req.body as User;

// WRONG: Non-null assertion
const name = req.body.name!; // "Trust me, it's not null"

// RIGHT: Validate, then trust
const result = userSchema.safeParse(req.body);
if (result.success) {
  const user = result.data; // Both TypeScript AND runtime agree this is valid
  greet(user);
}
```

### Related concepts

- **Type guards:** Functions that narrow types at runtime.
  ```ts
  function isString(x: unknown): x is string {
    return typeof x === 'string';
  }
  ```
- **Branded types:** TypeScript types that exist only at compile time to prevent mixing up similar primitives (e.g., `UserId` vs `PostId`).

---

## 4. Schema Parsing

### WHAT is it?

The process of taking raw input, validating it against a schema, and producing clean, typed output.

### WHY do we use it?

Parsing is more than validation. It transforms and sanitizes:

- Strips unknown fields.
- Applies defaults.
- Coerces types (if configured).
- Transforms values (trim, lowercase).

### HOW does it work?

Zod's `parse()` / `safeParse()` executes the schema as a function:

```ts
const schema = z.object({
  name: z.string().trim().toLowerCase().min(2),
  age: z.number().default(18),
});

schema.parse({ name: '  ALICE  ', age: 25 });
// → { name: 'alice', age: 25 }

schema.parse({ name: 'Bob' });
// → { name: 'bob', age: 18 }  (default applied)

schema.parse({ name: 'Bob', hacker: true });
// → { name: 'bob', age: 18 }  (unknown field stripped)
```

### WRONG way vs RIGHT way

```ts
// WRONG: Validation without parsing
function validateUser(input: unknown): boolean {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as any).name === 'string'
  );
}
// Returns boolean. You still have `unknown` data afterward.

// RIGHT: Parse and receive clean data
const result = userSchema.safeParse(input);
if (result.success) {
  result.data; // Clean, typed, transformed
}
```

### Related concepts

- **Decoders:** Libraries like `io-ts` and `runtypes` use the same pattern. Zod is the most popular in 2025.
- **OpenAPI generation:** Tools like `@asteasolutions/zod-to-openapi` derive API documentation directly from Zod schemas.

---

## Bonus: `.d.ts` Files

### WHAT is it?

A declaration file (`.d.ts`) contains TypeScript type information without implementation. It teaches the compiler about JavaScript code.

### WHY does it exist?

Most npm packages are written in JavaScript. TypeScript needs to know what `express()` returns, what `z.object()` accepts, etc. `.d.ts` files provide this metadata.

When you install `zod`, you get:

```ts
// node_modules/zod/lib/types.d.ts (simplified)
export declare abstract class ZodType<
  Output = any,
  Def extends ZodTypeDef = ZodTypeDef,
  Input = Output
> {
  parse(data: unknown): Output;
  safeParse(data: unknown): SafeParseReturnType<Input, Output>;
  // ...
}
```

This is how `z.object({}).safeParse()` gets autocomplete and type checking.

### HOW does it work?

TypeScript reads `.d.ts` files during compilation. They are **pure metadata** — no JavaScript is emitted from them.

When you write your own library, enable `"declaration": true` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

TypeScript will emit:
- `dist/validation.js` — your compiled code
- `dist/validation.d.ts` — the type declarations
- `dist/validation.d.ts.map` — maps declarations back to source (for IDE navigation)

Consumers of your package get full type safety without reading your source code.

### WRONG way vs RIGHT way

```ts
// WRONG: Writing types inline in JS with JSDoc (works but limited)
/**
 * @param {string} name
 * @returns {User}
 */
function createUser(name) { ... }

// RIGHT: Write in TypeScript, emit .d.ts automatically
export function createUser(name: string): User { ... }
// tsc emits createUser.d.ts

// WRONG: Duplicating .d.ts by hand (prone to drift)
// validation.ts and validation.d.ts getting out of sync

// RIGHT: Source of truth is the .ts file
```

### Related concepts

- **`skipLibCheck: true`:** Speeds up compilation by skipping type checking of `.d.ts` files in `node_modules`. Recommended for most projects.
- **Triple-slash references:** `/// <reference types="node" />` includes Node.js type declarations.
- **Type-only imports:** `import type { ZodType } from 'zod'` ensures the import is erased at runtime.
