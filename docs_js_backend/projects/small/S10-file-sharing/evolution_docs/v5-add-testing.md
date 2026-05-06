# v5 — Adding Tests

You just refactored your storage layer. You switched from `fs.writeFileSync` to a streaming approach for large files. You deploy.

A day later, someone reports they can still download expired files. You check. Your new streaming code doesn't check `expires_at` before piping the response. You broke the expiration check during the refactor.

Tests would have caught this.

## The Fix: Automated Tests

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import fs from 'fs';

describe('File Sharing API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM files').run();
    // Clean upload dir
  });

  it('uploads a file and returns a token', async () => {
    const res = await request(app)
      .post('/files/upload')
      .send({ file: Buffer.from('hello').toString('base64'), filename: 'hello.txt' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects expired downloads', async () => {
    const upload = await request(app)
      .post('/files/upload')
      .send({ file: Buffer.from('secret').toString('base64'), filename: 'secret.txt' });
    const token = upload.body.token;

    // Manually expire
    db.prepare('UPDATE files SET expires_at = ? WHERE token = ?').run(Date.now() - 1000, token);

    const res = await request(app).get(`/files/download/${token}`);
    expect(res.status).toBe(410);
  });

  it('prevents path traversal', async () => {
    const res = await request(app)
      .post('/files/upload')
      .send({ file: Buffer.from('evil').toString('base64'), filename: '../../../tmp/pwned.txt' });
    expect(res.status).toBe(201);
    // But the file should NOT exist at /tmp/pwned.txt
    expect(fs.existsSync('/tmp/pwned.txt')).toBe(false);
  });
});
```

## What Tests Caught

- The broken expiration check → caught
- Path traversal attempts → caught
- Missing filename validation → caught

## The Confidence

Now you can refactor the storage layer, add new features (zip uploads, image previews), and know that the core security invariants hold.

**Next:** Let's modernize the module system.
