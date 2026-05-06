import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import { app, manager } from '../src/index.js';

const TEST_CONFIG_PATH = path.resolve('./test-config.json');

describe('Config Manager', () => {
  beforeEach(async () => {
    try {
      await fs.unlink(TEST_CONFIG_PATH);
    } catch {
      // ignore
    }
    // Create fresh manager
    (manager as any).cache = new Map();
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_CONFIG_PATH);
    } catch {
      // ignore
    }
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
    // Setting a string where number is expected should fail
    await request(app)
      .post('/config')
      .send({ key: 'api.port', value: 'not-a-number' });

    // The system should reject invalid types
    const res = await request(app).get('/config/api.port');
    // BUG: No validation means string is accepted
    // This test documents expected behavior that should fail
    expect(typeof res.body.value).not.toBe('string');
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
    // Should reject circular references or malformed data
    const res = await request(app)
      .post('/config')
      .send({ key: 'bad', value: undefined });

    // Should return error for invalid value
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should persist across reloads', async () => {
    await request(app)
      .post('/config')
      .send({ key: 'feature.x', value: true });

    // Simulate reload by reading file
    const data = await fs.readFile('./config.json', 'utf-8');
    const parsed = JSON.parse(data);
    expect(parsed['feature.x']).toBe(true);
  });
});
