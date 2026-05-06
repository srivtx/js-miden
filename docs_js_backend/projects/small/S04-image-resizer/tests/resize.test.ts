import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_DIR = './uploads';

async function ensureFixtures() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  // Create a 1x1 red png buffer
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  await writeFile(join(UPLOAD_DIR, 'test.png'), png);
}

describe('S04 Image Resizer', () => {
  it('uploads an image', async () => {
    await ensureFixtures();
    const res = await request(app)
      .post('/upload')
      .attach('image', join(UPLOAD_DIR, 'test.png'));
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });

  it('resizes an image', async () => {
    await ensureFixtures();
    const uploadRes = await request(app)
      .post('/upload')
      .attach('image', join(UPLOAD_DIR, 'test.png'));
    const id = uploadRes.body.id;
    const res = await request(app).get(`/resize/${id}?width=10&height=10`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image/);
  });

  it('returns 404 for missing image', async () => {
    const res = await request(app).get('/resize/nonexistent?width=10');
    expect(res.status).toBe(404);
  });
});
