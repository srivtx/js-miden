# 05-BUILD.md — CSV Parser API (M17)

## Step-by-Step Build

### Prerequisites

- Node.js 20+
- npm or pnpm

---

### Step 1: Project Scaffold

```bash
mkdir M17-csv-parser && cd M17-csv-parser
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

### Step 3: The Safe Parser

Create `src/parser.ts`:

```typescript
export interface ParseOptions {
  requiredHeaders?: string[];
  maxRows?: number;
  maxCellLength?: number;
}

export interface ParseResult {
  rowCount: number;
  headers: string[];
  data: Record<string, string>[];
}

function stripBOM(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

function sanitizeCell(value: string): string {
  const dangerous = /^[=+\-@\t\r\n]/;
  if (dangerous.test(value)) {
    return "'" + value;
  }
  return value;
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseCsvSafe(
  csvText: string,
  options: ParseOptions = {}
): ParseResult {
  const { requiredHeaders = [], maxRows = 10000, maxCellLength = 10000 } = options;

  if (!csvText || csvText.trim().length === 0) {
    throw new Error("CSV text is empty");
  }

  const cleanText = stripBOM(csvText);
  const lines = cleanText.split(/\r?\n/);

  if (lines.length === 0) {
    throw new Error("CSV has no lines");
  }

  const headers = parseLine(lines[0]).map((h) => h.trim());

  for (const h of requiredHeaders) {
    if (!headers.includes(h.trim())) {
      throw new Error(`Missing required header: ${h}`);
    }
  }

  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;

    if (data.length >= maxRows) {
      throw new Error(`Row count exceeds maximum allowed (${maxRows})`);
    }

    const cells = parseLine(line);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      let cell = cells[j] ?? "";
      if (cell.length > maxCellLength) {
        throw new Error(`Cell exceeds maximum length at row ${i}, column ${headers[j]}`);
      }
      cell = sanitizeCell(cell);
      row[headers[j]] = cell;
    }

    data.push(row);
  }

  return { rowCount: data.length, headers, data };
}
```

---

### Step 4: The Express App

Create `src/index.ts`:

```typescript
import express, { Request, Response } from "express";
import { parseCsvSafe } from "./parser.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/upload-csv", async (req: Request, res: Response) => {
  try {
    const csvText = req.body.csv || "";
    const requiredHeaders =
      (req.body.requiredHeaders as string | undefined)
        ?.split(",")
        .filter(Boolean) || [];
    const maxRows = Number(req.body.maxRows) || 10000;

    const result = parseCsvSafe(csvText, { requiredHeaders, maxRows });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`M17 CSV Parser API running on port ${PORT}`);
});

export default app;
```

---

### Step 5: Tests

Create `tests/app.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";

describe("M17 CSV Parser API", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("POST /upload-csv parses simple CSV", async () => {
    const csv = "name,email\nAlice,alice@example.com\nBob,bob@example.com";
    const res = await request(app)
      .post("/upload-csv")
      .send({ csv, requiredHeaders: "name,email" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rowCount).toBe(2);
    expect(res.body.data[0].name).toBe("Alice");
  });

  it("rejects missing required headers", async () => {
    const csv = "name,email\nAlice,alice@example.com";
    const res = await request(app)
      .post("/upload-csv")
      .send({ csv, requiredHeaders: "name,missing" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required header");
  });

  it("strips BOM from UTF-8 CSV", async () => {
    const csv = "\uFEFFname,email\nAlice,alice@example.com";
    const res = await request(app)
      .post("/upload-csv")
      .send({ csv, requiredHeaders: "name" });

    expect(res.status).toBe(200);
    expect(res.body.headers[0]).toBe("name");
  });

  it("sanitizes formula injection cells", async () => {
    const csv = "name,formula\nAlice,=cmd|(' /C calc')!A0";
    const res = await request(app).post("/upload-csv").send({ csv });

    expect(res.status).toBe(200);
    expect(res.body.data[0].formula).toBe("'=cmd|(' /C calc')!A0");
  });

  it("enforces maxRows limit", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => `name${i}`).join("\n");
    const csv = `name\n${rows}`;
    const res = await request(app)
      .post("/upload-csv")
      .send({ csv, maxRows: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Row count exceeds maximum");
  });

  it("rejects empty CSV", async () => {
    const res = await request(app).post("/upload-csv").send({ csv: "" });
    expect(res.status).toBe(400);
  });
});
```

---

### Step 6: Run

```bash
npm run dev     # tsx src/index.ts
npm test        # vitest
```

---

### Step 7: The Fix (From Buggy to Safe)

If you started with a naive parser, replace it:

```typescript
// WRONG — do not do this
const lines = text.split(/\r?\n/);
const headers = lines[0].split(","); // breaks on quoted commas
const data = [];
for (let i = 1; i < lines.length; i++) {
  const cells = lines[i].split(","); // also breaks
  const row: Record<string, string> = {};
  for (let j = 0; j < headers.length; j++) {
    row[headers[j]] = cells[j] ?? ""; // no formula sanitization
  }
  data.push(row);
}

// RIGHT — use the safe parser from Step 3
const result = parseCsvSafe(csvText, { requiredHeaders, maxRows });
```

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `file.buffer.toString()` without limits | Enforce `maxRows`, `maxCellLength` |
| `line.split(',')` | RFC 4180 state-machine parser |
| Return raw cells | Prefix `=`, `+`, `-`, `@` with `'` |
| Ignore BOM | Strip `\uFEFF` before parsing |
| No row limit | Abort early at `maxRows` |

## SOURCES

- [RFC 4180 — Common Format and MIME Type for CSV Files](https://datatracker.ietf.org/doc/html/rfc4180)
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
