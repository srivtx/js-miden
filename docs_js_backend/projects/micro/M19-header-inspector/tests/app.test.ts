import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M19 Header Inspector', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /headers returns request headers', async () => {
    const res = await request(app)
      .get('/headers')
      .set('X-Custom-Header', 'test-value');

    expect(res.status).toBe(200);
    expect(res.body.headers['x-custom-header']).toBe('test-value');
  });

  it('GET /ip returns client IP', async () => {
    const res = await request(app).get('/ip');
    expect(res.status).toBe(200);
    expect(res.body.ip).toBeDefined();
    expect(res.body.source).toBeDefined();
  });

  it('GET /ip ignores spoofed X-Forwarded-From from untrusted proxy', async () => {
    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '1.2.3.4');

    expect(res.status).toBe(200);
    // Since supertest connects directly, remoteAddress won't be a trusted proxy
    // so it should return the direct IP, not 1.2.3.4
    expect(res.body.ip).not.toBe('1.2.3.4');
  });

  it('GET /security analyzes headers', async () => {
    const res = await request(app).get('/security');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.present)).toBe(true);
    expect(Array.isArray(res.body.missing)).toBe(true);
    expect(res.body.score).toBeDefined();
  });

  it('sets security headers on responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});
