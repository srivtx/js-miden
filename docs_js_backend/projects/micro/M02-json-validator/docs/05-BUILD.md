# 05 — BUILD: Step-by-Step from Empty Folder

This guide takes you from an empty directory to a fully working, tested JSON validation API.

---

## Step 0: Prerequisites

```bash
node --version  # v20.x.x or higher
npm --version   # 10.x.x or higher
```

---

## Step 1: Initialize the Project

```bash
mkdir M02-json-validator
cd M02-json-validator
npm init -y
```

---

## Step 2: Configure ESM

Edit `package.json`:

```json
{
  "name": "m02-json-validator",
  "version": "1.0.0",
  "type": "module",
  "scripts": {},
  "dependencies": {},
  "devDependencies": {}
}
```

**Why `"type": "module"`:** Tells Node.js to interpret all `.js` files as ESM. Without this, `import` statements throw syntax errors.

---

## Step 3: Install Dependencies

```bash
npm install express@5 zod@3
npm install -D typescript@5 @types/node@22 @types/express@5 @types/supertest@6 tsx@4 vitest@2 supertest@7
```

**What each package does:**

| Package | Role |
|---------|------|
| `express` | HTTP framework. Handles routing, request/response lifecycle. |
| `zod` | Schema validation library. `z.object()` defines shape; `.safeParse()` validates. |
| `typescript` | TypeScript compiler. `tsc` transpiles `.ts` to `.js`. |
| `@types/node` | Types for Node.js built-ins (`process`, `console`). |
| `@types/express` | Types for Express (`Request`, `Response`). |
| `@types/supertest` | Types for Supertest. |
| `tsx` | Runs TypeScript files directly without pre-compilation. |
| `vitest` | Test runner. Native ESM support. |
| `supertest` | HTTP testing utility. Makes requests against Express without a real server. |

---

## Step 4: Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": ".",
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

**Key fields explained:**

| Field | Meaning |
|-------|---------|
| `target: ES2022` | Output modern JavaScript. |
| `module: NodeNext` | Use Node.js ESM module resolution. |
| `strict: true` | Enable all strict type checking. Catches `null`/`undefined` errors. |
| `esModuleInterop: true` | Allow default imports from CommonJS packages. |
| `skipLibCheck: true` | Do not type-check `node_modules` declaration files. Faster builds. |
| `outDir: ./dist` | Compiled output goes here. |
| `rootDir: .` | TypeScript uses project root for path mapping. |

---

## Step 5: Create the Zod Schema

Create `src/validation.ts`:

```ts
import { z } from 'zod';

/**
 * Schema for user validation.
 *
 * Rules:
 * - name: string, 2-50 characters
 * - email: valid email format
 * - age: integer, 18-120
 * - Unknown fields are stripped by default
 */
export const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
}).passthrough(); // ← BUG (see 06-BUGS.md)

/**
 * TypeScript type inferred from the schema.
 *
 * This is equivalent to:
 *   type User = { name: string; email: string; age: number; }
 *
 * But it is automatically kept in sync with the schema.
 */
export type User = z.infer<typeof userSchema>;
```

**Every import explained:**

- `import { z } from 'zod'`
  - Named import. `z` is the Zod namespace. All schema builders live on it: `z.string()`, `z.number()`, `z.object()`.

**Every function explained:**

- `z.object({ ... })`:
  - Creates an object schema. Keys are field names; values are field schemas.
  - Validates that input is an object with the specified keys.

- `z.string()`:
  - Validates that the value is a string.
  - `.min(2)` adds a constraint: length must be >= 2.
  - `.max(50)` adds a constraint: length must be <= 50.

- `z.string().email()`:
  - Validates that the string matches an email regex.
  - The regex is RFC 5322 compliant (simplified). It catches `not-an-email` but allows some edge cases.

- `z.number()`:
  - Validates that the value is a number.
  - `.int()` requires it to be an integer (no decimals).
  - `.min(18)` and `.max(120)` set the range.

- `.passthrough()`:
  - Modifies the object schema to allow and return unknown keys.
  - Without it, Zod's default is to **strip** unknown keys.
  - **This line contains the intentional bug.** See 06-BUGS.md.

- `z.infer<typeof userSchema>`:
  - A TypeScript utility type. It reads the schema's TypeScript type definition and extracts the output type.
  - This is compile-time only. It generates zero JavaScript.

---

## Step 6: Create the Express App

Create `src/app.ts`:

```ts
import express, { Request, Response } from 'express';
import { userSchema } from './validation.js';

export const app = express();

// Parse JSON request bodies
app.use(express.json());

/**
 * POST /validate
 *
 * Accepts a JSON body, validates it against userSchema,
 * and returns either the validated data or structured errors.
 */
app.post('/validate', (req: Request, res: Response) => {
  const result = userSchema.safeParse(req.body);

  if (!result.success) {
    // Map Zod's internal error format to our API contract
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    res.status(400).json({ valid: false, errors });
    return;
  }

  // result.data is fully typed and stripped of unknown fields
  res.status(200).json({ valid: true, data: result.data });
});
```

**Every import explained:**

- `import express, { Request, Response } from 'express'`
  - `express`: default import. The function that creates an app.
  - `Request`, `Response`: named type imports. Used to type the route handler parameters.

- `import { userSchema } from './validation.js'`
  - Named import of our Zod schema. Note the `.js` extension — required in ESM.

**Every function explained:**

- `export const app = express();`
  - Creates the Express application instance.
  - We export it directly (not a factory) because this project does not need test isolation at the app level.

- `app.use(express.json());`
  - Built-in Express middleware.
  - Reads the request body, parses it as JSON, and assigns it to `req.body`.
  - Without this, `req.body` is `undefined`.
  - Default limit: 100KB. Default strict: only arrays and objects.

- `app.post('/validate', (req, res) => { ... })`:
  - Registers a route handler for `POST /validate`.
  - `req: Request` — the incoming request. Has `req.body`, `req.headers`, etc.
  - `res: Response` — the outgoing response. Has `res.json()`, `res.status()`, etc.

- `userSchema.safeParse(req.body)`:
  - Validates `req.body` against the schema.
  - Returns a `SafeParseReturnType` — a discriminated union:
    - `{ success: true, data: User }`
    - `{ success: false, error: ZodError }`
  - Does NOT throw. Safe to call without `try/catch`.

- `result.error.errors`:
  - An array of `ZodIssue` objects. Each issue describes one validation failure.
  - `err.path`: array of keys to the invalid field (e.g., `['address', 'zip']` for nested objects).
  - `err.message`: human-readable error string.

- `err.path.join('.')`:
  - Converts `['address', 'zip']` to `"address.zip"`.
  - Creates a flat `field` string suitable for frontend error mapping.

- `res.status(400).json({ valid: false, errors })`:
  - Sets HTTP status to 400 (Bad Request).
  - Sends JSON response with `Content-Type: application/json`.
  - The `return` after `res.status(...).json(...)` is critical. Without it, the function continues to the success response and tries to send a second response, which causes Express to throw `Error: Cannot set headers after they are sent to the client`.

---

## Step 7: Create the Entry Point

Create `src/index.ts`:

```ts
import { app } from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Every line explained:**

- `import { app } from './app.js'`
  - Imports the configured Express app. No factory pattern here — we use the singleton.

- `const PORT = process.env.PORT || 3000;`
  - Reads environment variable. Falls back to 3000 for local development.

- `app.listen(PORT, callback)`
  - Starts an HTTP server on the specified port.
  - Callback runs once the server is ready to accept connections.

---

## Step 8: Create Tests

Create `tests/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('POST /validate', () => {
  it('accepts a valid user object', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'alice@example.com', age: 25 });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.data).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      age: 25,
    });
  });

  it('rejects a name that is too short', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'A', email: 'a@example.com', age: 25 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
  });

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'not-an-email', age: 25 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })])
    );
  });

  it('rejects age below 18', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'alice@example.com', age: 17 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'age' })])
    );
  });

  it('rejects age above 120', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'alice@example.com', age: 121 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'age' })])
    );
  });

  it('rejects string age (no type coercion)', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Alice', email: 'alice@example.com', age: '25' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'age' })])
    );
  });

  // BUG REPRODUCTION TEST (see 06-BUGS.md)
  it('strips unknown fields (security)', async () => {
    const res = await request(app)
      .post('/validate')
      .send({
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        role: 'admin',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('role');
  });
});
```

**Every import explained:**

- `import { describe, it, expect } from 'vitest'`
  - Vitest test DSL. `describe` groups tests; `it` defines a test case; `expect` creates assertions.

- `import request from 'supertest'`
  - Default import. `request(app)` returns a chainable HTTP client for testing.

- `import { app } from '../src/app.js'`
  - Imports the Express app instance. Tests use the same app the server uses.

**Every function explained:**

- `request(app).post('/validate').send({ ... })`:
  - Supertest simulates a POST request with a JSON body.
  - Sets `Content-Type: application/json` automatically.

- `expect(res.status).toBe(200)`:
  - Asserts the HTTP status code is 200.

- `expect(res.body).toEqual({ ... })`:
  - Asserts the parsed JSON response body matches the expected object.

- `expect.arrayContaining([...])`:
  - Matcher that passes if the array contains at least the specified elements (in any order).

- `expect.objectContaining({ field: 'name' })`:
  - Matcher that passes if the object has at least the specified properties.

- `expect(res.body.data).not.toHaveProperty('role')`:
  - Asserts that the `data` object does NOT contain a `role` key.
  - This is the assertion that fails because of the `.passthrough()` bug.

---

## Step 9: Add npm Scripts

Edit `package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Runs `src/index.ts` directly with `tsx`. No compilation step. |
| `npm run build` | Compiles TypeScript to `dist/`. |
| `npm start` | Runs the compiled `dist/index.js` with Node. |
| `npm test` | Runs Vitest once and exits. Used in CI. |

---

## Step 10: Run It

```bash
# Development
npm run dev
# → Server running on port 3000

# In another terminal:
curl -X POST http://localhost:3000/validate \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","age":25}'
# → {"valid":true,"data":{"name":"Alice","email":"alice@example.com","age":25}}

# Tests (one will fail — that's the intentional bug)
npm test

# Build for production
npm run build
npm start
```

You now have a fully working, tested, schema-validated API.
