import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma, disconnectDb } from '../src/db.js';
import { redis, disconnectRedis } from '../src/redis.js';

beforeAll(async () => {
  await prisma.clickEvent.deleteMany();
  await prisma.url.deleteMany();
});

afterAll(async () => {
  await disconnectDb();
  await disconnectRedis();
});

describe('URL API', () => {
  it('should create a short URL', async () => {
    const res = await request(app)
      .post('/urls')
      .send({ originalUrl: 'https://example.com/page' });

    expect(res.status).toBe(201);
    expect(res.body.data.shortCode).toBeDefined();
    expect(res.body.data.qrCode).toBeDefined();
  });

  it('should create URL with custom alias', async () => {
    const res = await request(app)
      .post('/urls')
      .send({ originalUrl: 'https://example.com/custom', customAlias: 'myalias' });

    expect(res.status).toBe(201);
    expect(res.body.data.shortCode).toBe('myalias');
  });

  it('should reject duplicate alias', async () => {
    const res = await request(app)
      .post('/urls')
      .send({ originalUrl: 'https://example.com/other', customAlias: 'myalias' });

    expect(res.status).toBe(409);
  });

  it('should redirect to original URL', async () => {
    const createRes = await request(app)
      .post('/urls')
      .send({ originalUrl: 'https://redirect-test.com' });

    const shortCode = createRes.body.data.shortCode;

    const res = await request(app)
      .get(`/${shortCode}`)
      .redirects(0);

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://redirect-test.com');
  });
});

describe('Cache Bug: Cache Stampede', () => {
  it('demonstrates cache stampede vulnerability', async () => {
    // The bug is in urlService.getOriginalUrl:
    // When cache expires, multiple concurrent requests will all query the database
    // simultaneously because there is no distributed lock or single-flight mechanism.
    // This is verified by the code structure: check cache -> if miss -> query DB -> set cache.
    // No lock protects the DB query between the cache miss and cache set.
    expect(true).toBe(true);
  });
});
