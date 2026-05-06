# Step-by-Step Build Guide

## Step 1: Initialize the Project

```bash
mkdir M14-uuid-generator
cd M14-uuid-generator
npm init -y
```

Install dependencies:
```bash
npm install express
npm install -D typescript tsx @types/express @types/node vitest supertest @types/supertest
```

**Why these packages:**
- `express`: HTTP framework.
- `vitest` + `supertest`: Testing framework and HTTP assertion library.

### Common Mistakes at This Step
- **Mistake:** Installing `@types/node` for the wrong Node.js version.
  - **Why it breaks:** `crypto.randomUUID()` was added in Node.js 14.17. If your types are for Node.js 12, TypeScript will complain.
  - **How to avoid:** Use `@types/node@^20` or `@types/node@^22`.

---

## Step 2: Configure TypeScript

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### Common Mistakes at This Step
- **Mistake:** Using `"target": "ES2015"`.
  - **Why it breaks:** `crypto.randomUUID()` requires a modern target.
  - **How to avoid:** Use `"target": "ES2022"` or later.

---

## Step 3: Create the UUID Module

Create `src/uuid.ts`:
```typescript
import { randomUUID } from "node:crypto";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateUUID(): string {
  return randomUUID();
}

export function isValidUUID(uuid: string): boolean {
  return UUID_V4_REGEX.test(uuid);
}
```

**Why `node:crypto`:** The `node:` prefix is the recommended way to import built-in Node.js modules. It makes it clear that this is a built-in, not an npm package.

### Common Mistakes at This Step
- **Mistake:** Using `Math.random()` instead of `crypto.randomUUID()`.
  - **Why it breaks:** Predictable UUIDs compromise security.
  - **How to avoid:** Always use `crypto.randomUUID()` or a CSPRNG.

---

## Step 4: Create the Express App

Create `src/app.ts`:
```typescript
import express, { Request, Response } from "express";
import { generateUUID, isValidUUID } from "./uuid.js";

export const app = express();
app.use(express.json());

app.post("/generate", (_req: Request, res: Response) => {
  const uuid = generateUUID();
  res.json({ uuid });
});

app.get("/validate/:uuid", (req: Request, res: Response) => {
  const { uuid } = req.params;
  const valid = isValidUUID(uuid);
  res.json({ uuid, valid });
});

if (import.meta.url.endsWith(process.argv[1] ?? "")) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`M14 UUID Generator running on port ${PORT}`);
  });
}
```

**Why `import.meta.url` check:** This allows the app to be imported in tests without starting the server.

### Common Mistakes at This Step
- **Mistake:** Using `GET /generate`.
  - **Why it breaks:** `GET` responses may be cached, causing multiple clients to receive the same UUID.
  - **How to avoid:** Use `POST /generate` for non-idempotent operations.

---

## Step 5: Add Tests

Create `tests/app.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("M14 UUID Generator", () => {
  it("POST /generate returns a valid UUID v4", async () => {
    const res = await request(app).post("/generate").expect(200);
    expect(res.body.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("GET /validate/:uuid returns true for valid UUID", async () => {
    const res = await request(app)
      .get("/validate/550e8400-e29b-41d4-a716-446655440000")
      .expect(200);
    expect(res.body.valid).toBe(true);
  });

  it("GET /validate/:uuid returns false for invalid UUID", async () => {
    const res = await request(app)
      .get("/validate/not-a-uuid")
      .expect(200);
    expect(res.body.valid).toBe(false);
  });

  it("GET /validate/:uuid returns false for wrong version", async () => {
    const res = await request(app)
      .get("/validate/550e8400-e29b-11d4-a716-446655440000")
      .expect(200);
    expect(res.body.valid).toBe(false);
  });
});
```

**Why these tests:** The first verifies generation. The second verifies validation of a correct UUID. The third verifies rejection of malformed strings. The fourth verifies rejection of UUIDs with the wrong version.

### Common Mistakes at This Step
- **Mistake:** Testing with a UUID that has the wrong variant.
  - **Why it breaks:** Your test might pass even if the regex is wrong.
  - **How to avoid:** Test with UUIDs that have correct AND incorrect versions AND variants.

---

## Step 6: Add the Bug Demo

Create `bug/bug.ts`:
```typescript
function buggyGenerateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const BUGGY_UUID_REGEX = /^[0-9a-f-]{36}$/i;

function buggyIsValidUUID(uuid: string): boolean {
  return BUGGY_UUID_REGEX.test(uuid);
}

console.log("Buggy UUID:", buggyGenerateUUID());
console.log("Invalid UUID accepted?", buggyIsValidUUID("gggggggg-gggg-gggg-gggg-gggggggggggg"));
```

Run it:
```bash
npx tsx bug/bug.ts
```

**Why this bug exists:** It demonstrates two common mistakes: using `Math.random()` and using a permissive regex.

### Common Mistakes at This Step
- **Mistake:** Leaving the bug file in production.
  - **Why it breaks:** The bug file is for educational purposes only. It should not be deployed.
  - **How to avoid:** Add `bug/` to `.gitignore` or `.dockerignore`.
