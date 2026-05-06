# M32 Content Negotiation — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor `selectFormat` to support quality values:

```ts
// BEFORE
export function selectFormat(items: AcceptItem[], supported: SupportedFormat[]): SupportedFormat | null {
  const mimeMap: Record<SupportedFormat, string> = {
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    text: 'text/plain',
  };

  for (const item of items) {
    for (const format of supported) {
      const [t, s] = mimeMap[format].split('/');
      if (item.type === t && item.subtype === s) {
        return format;
      }
    }
  }
  return null;
}

// AFTER — "simpler" but WRONG
export function selectFormat(items: AcceptItem[], supported: SupportedFormat[]): SupportedFormat | null {
  const mimeMap: Record<SupportedFormat, string> = {
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    text: 'text/plain',
  };

  for (const item of items) {
    for (const format of supported) {
      const [t, s] = mimeMap[format].split('/');
      // BUG: Wildcard */* does not match because we compare exact strings
      if (item.type === t && item.subtype === s) {
        return format;
      }
    }
  }
  return null;
}
```

Wait, that's the same code. The bug is already there: `*/*` doesn't match anything. You never noticed because you didn't test wildcards.

You deploy. A monitoring tool sends `Accept: */*` and gets JSON, which is fine... until a client sends `Accept: text/*` expecting HTML and gets the default JSON instead.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/negotiation.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M32 Content Negotiation', () => {
  it('returns JSON when Accept: application/json', async () => {
    const res = await request(app).get('/resource').set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ message: 'Hello' });
  });

  it('returns HTML when Accept: text/html', async () => {
    const res = await request(app).get('/resource').set('Accept', 'text/html');
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<html>');
  });

  it('returns XML when Accept: application/xml', async () => {
    const res = await request(app).get('/resource').set('Accept', 'application/xml');
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<?xml');
  });

  it('defaults to JSON when no Accept header', async () => {
    const res = await request(app).get('/resource');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('handles */* wildcard', async () => {
    const res = await request(app).get('/resource').set('Accept', '*/*');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('respects quality values', async () => {
    const res = await request(app)
      .get('/resource')
      .set('Accept', 'text/html;q=0.8, application/json;q=1.0');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
```

**What tests prevent:**
- The wildcard `*/*` mismatch? Caught.
- The quality value sort regression? Caught.
- The default format change? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
