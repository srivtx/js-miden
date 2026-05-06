import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M34 Validate Headers', () => {
  it('allows valid Content-Type in lenient mode', async () => {
    const res = await request(app)
      .get('/public')
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
  });

  it('warns but allows invalid Content-Type in lenient mode', async () => {
    const res = await request(app)
      .get('/public')
      .set('Content-Type', 'image/png');
    expect(res.status).toBe(200);
    expect(res.body.warnings).toBeDefined();
  });

  it('rejects missing required header in strict mode', async () => {
    const res = await request(app).post('/private');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Header validation failed');
  });

  it('accepts valid custom token in strict mode', async () => {
    const res = await request(app)
      .post('/private')
      .set('Authorization', 'Bearer tokentokentoken')
      .set('X-Custom-Token', 'ABCDEF1234567890ABCDEF1234567890');
    expect(res.status).toBe(200);
  });

  // BUG REPRODUCTION
  it('BUG: lowercase header names are not recognized', async () => {
    // Per RFC 2616, headers are case-insensitive.
    // The buggy code uses req.headers[rule.name] with exact case.
    const res = await request(app)
      .get('/public')
      .set('content-type', 'application/json'); // lowercase

    // Because the validator looks for 'Content-Type' (PascalCase),
    // it won't find 'content-type' in req.headers by exact key lookup.
    // In lenient mode, it might warn about invalid format because value is undefined.
    // In strict mode, it might reject as missing.
    expect(res.body.warnings).toBeDefined();
    const hasContentTypeWarning = res.body.warnings?.some((w: string) =>
      w.includes('Content-Type')
    );
    // This documents the bug: lowercase content-type causes a false warning.
    expect(hasContentTypeWarning).toBe(false); // This FAILS until fixed
  });
});
