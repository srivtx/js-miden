import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/server.js';

const uploadsDir = path.join(process.cwd(), 'uploads');

describe('POST /upload', () => {
  beforeAll(() => {
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(uploadsDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
  });

  it('should save the uploaded file to local disk', async () => {
    const fileName = 'test-image.png';
    const filePath = path.join(uploadsDir, fileName);

    const res = await request(app)
      .post('/upload')
      .attach('image', Buffer.from('fake-image-data'), fileName);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe(`/uploads/${fileName}`);

    // -------------------------------------------------------------------------
    // THIS ASSERTION FAILS DUE TO THE BUG:
    // multer is configured with memoryStorage, so the file is never written
    // to disk. It only exists as a Buffer in RAM during the request.
    // -------------------------------------------------------------------------
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should reject files larger than 5MB', async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB

    const res = await request(app)
      .post('/upload')
      .attach('image', largeBuffer, 'large.png');

    expect(res.status).toBe(413);
  });

  it('should reject non-image file types', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('image', Buffer.from('not an image'), 'file.exe');

    expect(res.status).toBe(400);
  });
});
