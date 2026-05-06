# 05-BUILD.md — Simple Redirector (M16)

## Step-by-Step Build

### Prerequisites

- Node.js 20+
- npm or pnpm

---

### Step 1: Project Scaffold

```bash
mkdir M16-redirector && cd M16-redirector
npm init -y
npm install express
npm install -D typescript @types/express @types/node vitest supertest @types/supertest tsx
```

---

### Step 2: TypeScript Configuration

`tsconfig.json`:
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
  }
}
```

---

### Step 3: The Validator Module

Create `src/validator.ts`:

```typescript
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return false;
    }

    if (!parsed.hostname) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
```

---

### Step 4: The Express App

Create `src/app.ts`:

```typescript
import express, { Request, Response } from "express";
import { isValidRedirectUrl } from "./validator.js";

export const app = express();
app.use(express.json());

app.post("/redirect", (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url in request body" });
    return;
  }

  if (!isValidRedirectUrl(url)) {
    res.status(400).json({ error: "Invalid or unsafe URL" });
    return;
  }

  res.redirect(302, url);
});

app.get("/info", (req: Request, res: Response) => {
  res.json({
    headers: req.headers,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
  });
});

if (import.meta.url.endsWith(process.argv[1] ?? "")) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`M16 Simple Redirector running on port ${PORT}`);
  });
}
```

---

### Step 5: Tests

Create `tests/app.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("M16 Simple Redirector", () => {
  it("POST /redirect returns 302 for valid HTTP URL", async () => {
    await request(app)
      .post("/redirect")
      .send({ url: "https://example.com" })
      .expect(302)
      .expect("Location", "https://example.com");
  });

  it("POST /redirect rejects javascript: URLs", async () => {
    const res = await request(app)
      .post("/redirect")
      .send({ url: "javascript:alert('xss')" })
      .expect(400);
    expect(res.body.error).toBe("Invalid or unsafe URL");
  });

  it("POST /redirect rejects data: URLs", async () => {
    const res = await request(app)
      .post("/redirect")
      .send({ url: "data:text/html,<script>alert(1)</script>" })
      .expect(400);
    expect(res.body.error).toBe("Invalid or unsafe URL");
  });

  it("POST /redirect rejects missing url", async () => {
    const res = await request(app).post("/redirect").send({}).expect(400);
    expect(res.body.error).toBe("Missing url in request body");
  });

  it("GET /info returns request headers", async () => {
    const res = await request(app)
      .get("/info")
      .set("X-Custom-Header", "test")
      .expect(200);
    expect(res.body.headers["x-custom-header"]).toBe("test");
    expect(res.body.method).toBe("GET");
  });
});
```

---

### Step 6: Run

```bash
npm run dev     # tsx src/app.ts
npm test        # vitest
```

---

### Step 7: The Fix (No Blind Redirect)

If you started with a blind redirect, add validation:

```typescript
// WRONG — do not do this
app.post("/redirect", (req, res) => {
  res.redirect(req.body.url); // Any URL, any protocol!
});

// RIGHT — validate first
app.post("/redirect", (req, res) => {
  const { url } = req.body;
  if (!isValidRedirectUrl(url)) {
    return res.status(400).json({ error: "Invalid or unsafe URL" });
  }
  res.redirect(302, url);
});
```

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `res.redirect(url)` with no validation | `new URL(url)` + protocol whitelist |
| `301` for dynamic redirects | `302` for dynamic redirects |
| Accept `javascript:`, `data:` | Only allow `http:` and `https:` |
| String prefix checks | Built-in `URL` parser |

## SOURCES

- [RFC 7231 — HTTP/1.1 Semantics and Content](https://datatracker.ietf.org/doc/html/rfc7231)
- [OWASP Unvalidated Redirects Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
