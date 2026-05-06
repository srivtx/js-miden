import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('M32 Content Negotiation', () => {
  it('returns JSON when Accept: application/json', async () => {
    const res = await request(app)
      .get('/resource')
      .set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ message: 'Hello' });
  });

  it('returns HTML when Accept: text/html', async () => {
    const res = await request(app)
      .get('/resource')
      .set('Accept', 'text/html');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<html>');
  });

  it('returns XML when Accept: application/xml', async () => {
    const res = await request(app)
      .get('/resource')
      .set('Accept', 'application/xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<?xml');
  });

  it('returns text when Accept: text/plain', async () => {
    const res = await request(app)
      .get('/resource')
      .set('Accept', 'text/plain');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('defaults to JSON when no Accept header', async () => {
    const res = await request(app).get('/resource');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  // BUG REPRODUCTION
  it('BUG: */* should match JSON but does not', async () => {
    const res = await request(app)
      .get('/resource')
      .set('Accept', '*/*');
    // With the bug, selectFormat returns null for */* because it only does exact string matches.
    // It then falls back to default JSON, but the matching logic itself failed.
    // We verify the bug by checking that the internal matching returns null for */*.
    const { parseAcceptHeader, selectFormat } = await import('../src/negotiator.js');
    const items = parseAcceptHeader('*/*');
    const format = selectFormat(items, ['json', 'xml', 'html', 'text']);
    expect(format).toBeNull(); // BUG: This should be 'json', but is null
  });
});
