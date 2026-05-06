# v5-add-testing.md — "I broke the health endpoint adding auth"

## The Bug

You switch from `diskStorage` to `memoryStorage` to inspect file content before writing to disk:

```ts
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .png, .gif files are allowed'));
    }
  },
});
```

But the route still constructs a URL assuming the file is on disk:

```ts
router.post('/', upload.single('image'), (req, res) => {
  const fileUrl = `/uploads/${req.file.originalname}`;
  res.json({ message: 'File uploaded', url: fileUrl });
});
```

With `memoryStorage`, the file exists in RAM during the request. After the response, it's gone. The URL returns 404 forever. Users see "upload successful" but the image is missing.

You didn't test that the uploaded file is actually accessible.

## The 3am Page, Redux

You add streaming to write files to disk:

```ts
import fs from 'fs';
import path from 'path';

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = path.join('uploads', req.file.originalname);
  fs.writeFileSync(filePath, req.file.buffer);

  const fileUrl = `/uploads/${req.file.originalname}`;
  res.json({ message: 'File uploaded', url: fileUrl });
});
```

But now two users uploading `photo.jpg` overwrite each other's files. You get support tickets: "My profile picture changed to someone else's cat."

You didn't test concurrent uploads.

## Adding Vitest + Supertest

```bash
npm install -D vitest supertest @types/supertest
```

```ts
// tests/upload.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/server.js';

const uploadsDir = path.join(process.cwd(), 'uploads');

describe('File Uploader', () => {
  beforeAll(() => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test uploads
    fs.readdirSync(uploadsDir).forEach((f) => fs.unlinkSync(path.join(uploadsDir, f)));
  });

  it('uploads a valid image', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'test.jpg');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('File uploaded successfully');
  });

  it('rejects non-image files', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('image', Buffer.from([0x4d, 0x5a]), 'test.exe'); // MZ header

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only .jpg, .png, .gif');
  });

  it('rejects files over 5MB', async () => {
    const bigFile = Buffer.alloc(6 * 1024 * 1024); // 6MB
    const res = await request(app)
      .post('/upload')
      .attach('image', bigFile, 'big.jpg');

    expect(res.status).toBe(413);
    expect(res.body.error).toContain('too large');
  });

  it('rejects requests without a file', async () => {
    const res = await request(app).post('/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });

  it('the uploaded file is accessible via static serving', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'accessible.jpg');

    expect(res.status).toBe(200);

    const fileUrl = res.body.url;
    const getRes = await request(app).get(fileUrl);
    expect(getRes.status).toBe(200);
  });
});
```

Run the tests:

```bash
npm test
```

The "uploaded file is accessible" test fails with `memoryStorage`. The file URL returns 404 because the file was never written to disk. The test caught the bug.

The "rejects non-image files" test uses a real MZ header (Windows executable). The file filter catches it.

## Why Tests?

- **They test the full flow.** Not just "did the handler return 200" but "can I actually download the file afterward."
- **They test edge cases.** Big files, missing files, wrong types — all covered.
- **They prevent storage regressions.** Switch from disk to memory? The test fails.
- **They test magic numbers.** Send a real JPEG header, not just a `.jpg` filename.

## What Changed

- Added Vitest and Supertest as dev dependencies
- Tests cover valid upload, invalid type, oversize, missing file, and accessibility
- Tests use real binary headers (JPEG, EXE)
- Tests clean up after themselves
- Tests run in CI with `npm test`

## What We Still Need

Tests verify behavior. But our module system is CommonJS. Node.js 20+ prefers ESM. We need to modernize.

For that, we need to switch to ESM.
