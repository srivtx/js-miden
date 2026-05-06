import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('S26 File Upload', () => {
  const uploadDir = path.resolve('uploads');

  beforeAll(async () => {
    try { await fs.mkdir(uploadDir); } catch {}
  });

  afterAll(async () => {
    try { await fs.rm(uploadDir, { recursive: true, force: true }); } catch {}
  });

  it('uploads a valid image', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'test.png');
    expect([200, 201]).toContain(res.status);
  });

  it('rejects invalid magic number', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from([0x00, 0x00, 0x00, 0x00]), 'fake.jpg');
    expect(res.status).toBe(400);
  });

  it('BUG: allows path traversal via filename', async () => {
    const malicious = '../../../tmp/pwned.png';
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), malicious);

    expect(res.status).toBe(201);
    // In the buggy code, the file is written relative to uploads/ using the raw originalname
    expect(res.body.path).toContain('..');
  });
});
