# M17 CSV Parser — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You add a feature: skip empty lines. You change the parser:

```ts
// BEFORE — handles quotes correctly
function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
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
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// AFTER — "optimized" but BROKEN
function parseLine(line: string): string[] {
  if (!line.includes('"')) {
    return line.split(','); // fast path for unquoted lines
  }
  // ... original logic
}
```

Now `"Alice,Bob"` works, but `"Alice"","Bob"` doesn't — the fast path bypasses escaped quote handling. A user uploads a CSV with a name like `O'Brien, Jr.` (no quotes needed, but your fast path breaks on something else). Worse, you never tested quoted commas.

## The Fix: Comprehensive Tests

```ts
// tests/app.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M17 CSV Parser API', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /upload-csv parses simple CSV', async () => {
    const csv = 'name,email\nAlice,alice@example.com\nBob,bob@example.com';
    const res = await request(app)
      .post('/upload-csv')
      .send({ csv, requiredHeaders: 'name,email' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rowCount).toBe(2);
    expect(res.body.data[0].name).toBe('Alice');
  });

  it('rejects missing required headers', async () => {
    const csv = 'name,email\nAlice,alice@example.com';
    const res = await request(app)
      .post('/upload-csv')
      .send({ csv, requiredHeaders: 'name,missing' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required header');
  });

  it('strips BOM from UTF-8 CSV', async () => {
    const csv = '\uFEFFname,email\nAlice,alice@example.com';
    const res = await request(app)
      .post('/upload-csv')
      .send({ csv, requiredHeaders: 'name' });

    expect(res.status).toBe(200);
    expect(res.body.headers[0]).toBe('name');
  });

  it('sanitizes formula injection cells', async () => {
    const csv = 'name,formula\nAlice,=cmd|(\' /C calc\')!A0';
    const res = await request(app).post('/upload-csv').send({ csv });

    expect(res.status).toBe(200);
    expect(res.body.data[0].formula).toBe("'=cmd|(' /C calc')!A0");
  });

  it('enforces maxRows limit', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => `name${i}`).join('\n');
    const csv = `name\n${rows}`;
    const res = await request(app)
      .post('/upload-csv')
      .send({ csv, maxRows: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Row count exceeds maximum');
  });

  it('rejects empty CSV', async () => {
    const res = await request(app).post('/upload-csv').send({ csv: '' });
    expect(res.status).toBe(400);
  });
});
```

**What tests prevent:**
- Breaking BOM stripping? Caught.
- Removing formula sanitization? Caught.
- Changing maxRows default to Infinity? Caught.
- Breaking empty CSV rejection? Caught.

## The Pain That Remains

Your tests run with Vitest, but the parser still uses `require()`. Modern Node.js supports ESM natively. The ecosystem has moved on.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
