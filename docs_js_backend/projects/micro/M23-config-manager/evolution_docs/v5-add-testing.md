# v5: Add Testing — Config Manager

## The Pain

You refactor `save()` to use `fs.writeFileSync` for atomicity. It works locally. In production, the config file is 10MB and `writeFileSync` blocks the event loop for 200ms. Requests timeout. You didn't know because you only tested manually with a 1KB file.

## The Solution

Jest + Supertest. Test file I/O, validation, and API contracts.

## The Test File

```typescript
// tests/config-manager.test.ts
import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import { app, manager } from '../src/index.js';

const TEST_CONFIG_PATH = path.resolve('./test-config.json');

describe('Config Manager', () => {
  beforeEach(async () => {
    try { await fs.unlink(TEST_CONFIG_PATH); } catch { /* ignore */ }
    (manager as any).cache = new Map();
  });

  afterEach(async () => {
    try { await fs.unlink(TEST_CONFIG_PATH); } catch { /* ignore */ }
  });

  it('should store and retrieve config values', async () => {
    await request(app)
      .post('/config')
      .send({ key: 'api.timeout', value: 5000 });

    const res = await request(app).get('/config/api.timeout');
    expect(res.status).toBe(200);
    expect(res.body.value).toBe(5000);
  });

  it('should return 404 for missing keys', async () => {
    const res = await request(app).get('/config/missing');
    expect(res.status).toBe(404);
  });

  it('should validate numeric config values', async () => {
    await request(app)
      .post('/config')
      .send({ key: 'api.port', value: 'not-a-number' });

    const res = await request(app).get('/config/api.port');
    expect(typeof res.body.value).not.toBe('string'); // Validation should reject
  });

  it('should handle bulk updates', async () => {
    await request(app)
      .post('/config/bulk')
      .send({ 'db.host': 'localhost', 'db.port': 5432 });

    const res = await request(app).get('/config');
    expect(res.body['db.host']).toBe('localhost');
    expect(res.body['db.port']).toBe(5432);
  });

  it('should reject invalid JSON structure', async () => {
    const res = await request(app)
      .post('/config')
      .send({ key: 'bad', value: undefined });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should persist across reloads', async () => {
    await request(app)
      .post('/config')
      .send({ key: 'feature.x', value: true });

    const data = await fs.readFile('./config.json', 'utf-8');
    const parsed = JSON.parse(data);
    expect(parsed['feature.x']).toBe(true);
  });
});
```

## The Bug It Catches

The `should validate numeric config values` test catches the missing validation bug:

```typescript
// BEFORE: No validation
async set(key: string, value: any): Promise<void> {
  this.cache.set(key, value); // accepts "not-a-number" for api.port
  await this.save();
}
```

The test posts `value: 'not-a-number'` and then asserts the stored value is not a string. Without validation, the test fails.

## Why Tests Catch Breakage Before Deploy

- **Type safety at runtime**: Tests enforce that `api.port` is always a number
- **Persistence**: Tests verify `fs.writeFile` actually writes valid JSON
- **Error handling**: Tests confirm 404 for missing keys, not a 500 crash
- **Bulk ops**: Tests ensure `setMultiple` doesn't drop keys

Without tests, you only find out about the `"not-a-number"` bug when your HTTP client tries to connect to port `"not-a-number"` and throws `RangeError: port should be >= 0 and < 65536`.
