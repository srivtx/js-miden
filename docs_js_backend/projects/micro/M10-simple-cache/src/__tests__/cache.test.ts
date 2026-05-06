import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { cache } from '../cache.js';

describe('Cache API', () => {
  beforeEach(() => {
    // Reset internal store between tests
    cache['_internalStore']().clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /cache', () => {
    it('stores a key/value pair', async () => {
      const res = await request(app)
        .post('/cache')
        .send({ key: 'foo', value: 'bar' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ key: 'foo', value: 'bar', ttl: 60 });
    });

    it('rejects missing key', async () => {
      const res = await request(app)
        .post('/cache')
        .send({ value: 'bar' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('key');
    });

    it('rejects missing value', async () => {
      const res = await request(app)
        .post('/cache')
        .send({ key: 'foo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('value');
    });

    it('overwrites an existing key', async () => {
      await request(app).post('/cache').send({ key: 'foo', value: 'old' });
      await request(app).post('/cache').send({ key: 'foo', value: 'new' });

      const res = await request(app).get('/cache/foo');
      expect(res.status).toBe(200);
      expect(res.body.value).toBe('new');
    });
  });

  describe('GET /cache/:key', () => {
    it('returns 404 for missing key', async () => {
      const res = await request(app).get('/cache/nope');
      expect(res.status).toBe(404);
    });

    it('retrieves a stored value', async () => {
      await request(app).post('/cache').send({ key: 'foo', value: 'bar' });

      const res = await request(app).get('/cache/foo');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ key: 'foo', value: 'bar' });
    });

    it('returns expired key as 404', async () => {
      // Use a cache with 0ms TTL for this test
      const { SimpleCache } = await import('../cache.js');
      const fastCache = new SimpleCache(0);
      fastCache.set('gone', 'value');

      // Manually swap internal store to test expiration
      const originalStore = cache['_internalStore']();
      originalStore.set('gone', { value: 'value', expiresAt: Date.now() - 1 });

      const res = await request(app).get('/cache/gone');
      expect(res.status).toBe(404);
      originalStore.delete('gone');
    });
  });

  describe('DELETE /cache/:key', () => {
    it('removes an existing key', async () => {
      await request(app).post('/cache').send({ key: 'foo', value: 'bar' });

      const res = await request(app).delete('/cache/foo');
      expect(res.status).toBe(204);

      const getRes = await request(app).get('/cache/foo');
      expect(getRes.status).toBe(404);
    });

    it('returns 404 for non-existent key', async () => {
      const res = await request(app).delete('/cache/nope');
      expect(res.status).toBe(404);
    });
  });
});

describe('Cache implementation bugs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('BUG: orphaned timers accumulate when keys are overwritten', async () => {
    const { SimpleCache } = await import('../cache.js');
    const c = new SimpleCache(60);

    c.set('k', 'v1');
    c.set('k', 'v2');
    c.set('k', 'v3');

    // All 3 timers are still alive in the event loop
    // After 60s, the first two timers will try to delete 'k'
    // even though the value has been overwritten twice.
    expect(c._internalStore().size).toBe(1);

    vi.advanceTimersByTime(60_000);

    // BUG: The first timer fires and deletes the current value!
    // Even though it was only 60s since the LAST write, the FIRST
    // timer deletes it because timers are never cleared.
    expect(c.get('k')).toBeUndefined();
  });

  it('BUG: no size limit on Map', async () => {
    const { SimpleCache } = await import('../cache.js');
    const c = new SimpleCache(60);

    for (let i = 0; i < 100_000; i++) {
      c.set(`key-${i}`, { data: 'x'.repeat(1000) });
    }

    // BUG: No eviction policy, Map grows unbounded
    expect(c.size()).toBe(100_000);
  });
});
