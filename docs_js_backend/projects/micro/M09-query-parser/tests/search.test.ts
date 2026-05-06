import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('GET /search', () => {
  it('parses and reflects query params', async () => {
    const res = await request(app).get('/search?query=hello&page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Query: hello');
    expect(res.text).toContain('Page: 1');
    expect(res.text).toContain('Limit: 10');
  });

  it('demonstrates string concatenation bug (nextPage)', async () => {
    const res = await request(app).get('/search?query=test&page=1&limit=10');
    expect(res.status).toBe(200);
    // "1" + 1 == "11"
    expect(res.text).toContain('Next Page: 11');
  });

  it('accepts negative page (validation bug)', async () => {
    const res = await request(app).get('/search?page=-5&limit=10');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Page: -5');
  });

  it('accepts huge limit (DoS bug)', async () => {
    const res = await request(app).get('/search?limit=99999999');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Limit: 99999999');
  });

  it('reflects unsanitized input (XSS bug)', async () => {
    const xss = '<script>alert(1)</script>';
    const res = await request(app).get(`/search?query=${encodeURIComponent(xss)}`);
    expect(res.status).toBe(200);
    // The raw script tag is present in the HTML body
    expect(res.text).toContain(xss);
  });
});
