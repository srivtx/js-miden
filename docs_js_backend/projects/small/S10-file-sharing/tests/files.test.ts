import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import { getUploadDir, deleteFile } from '../src/storage.js';
import fs from 'fs';
import path from 'path';

describe('File Sharing API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM files').run();
    const dir = getUploadDir();
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        fs.unlinkSync(path.join(dir, f));
      }
    }
  });

  it('uploads a file and returns a token', async () => {
    const buffer = Buffer.from('hello world');
    const res = await request(app)
      .post('/files/upload')
      .send({ file: buffer.toString('base64'), filename: 'hello.txt' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('downloads a file by token', async () => {
    const buffer = Buffer.from('secret content');
    const upload = await request(app)
      .post('/files/upload')
      .send({ file: buffer.toString('base64'), filename: 'secret.txt' });
    const token = upload.body.token;

    const res = await request(app).get(`/files/download/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe('secret content');
  });

  it('BUG: allows download after expiration', async () => {
    const buffer = Buffer.from('expired content');
    const upload = await request(app)
      .post('/files/upload')
      .send({ file: buffer.toString('base64'), filename: 'expired.txt' });
    const token = upload.body.token;

    // Manually set expiration to the past
    db.prepare('UPDATE files SET expires_at = ? WHERE token = ?').run(Date.now() - 1000, token);

    const res = await request(app).get(`/files/download/${token}`);
    expect(res.status).toBe(200); // Should be 410 Gone, but bug allows it
  });

  it('BUG: is vulnerable to path traversal via filename', async () => {
    const buffer = Buffer.from('evil');
    const filename = '../../../tmp/pwned.txt';
    await request(app)
      .post('/files/upload')
      .send({ file: buffer.toString('base64'), filename });

    // The file was written outside the upload directory
    expect(fs.existsSync('/tmp/pwned.txt')).toBe(true);
    if (fs.existsSync('/tmp/pwned.txt')) fs.unlinkSync('/tmp/pwned.txt');
  });
});
