# v7-production-setup.md — "The final version"

## The Journey

We started with a file uploader that accepted anything:

```js
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('image'), (req, res) => {
  res.json({ message: 'File uploaded', filename: req.file.filename });
});
```

It accepted `.exe` files. It accepted 2GB "profile pictures." It wrote to disk before checking anything.

Here's what we added and why:

| Step | What we added | What bug it prevents |
|------|--------------|----------------------|
| v1 | No validation | Any file type, any size, disk exhaustion |
| v2 | TypeScript | `req.file.orignalname` → caught at compile time |
| v3 | Magic numbers | `malware.jpg` (actually .exe) → rejected by content |
| v4 | Pino logging | Mystery 413s → searchable JSON with context |
| v5 | Vitest + Supertest | Memory storage loses files → caught in CI |
| v6 | ESM | `__dirname` hacks, no promisified streams → gone |
| v7 | Production setup | Everything wired, intentional bug to find |

## Final File Structure

```
M06-file-uploader/
├── src/
│   ├── server.ts         # Entry point: static serving, error handling
│   ├── routes/
│   │   └── upload.ts     # Upload route, file URL construction
│   └── middleware/
│       └── upload.ts     # Multer config with MIME filter
├── tests/
│   └── upload.test.ts    # Vitest: valid, invalid, oversize, accessibility
├── package.json          # ESM, scripts, dependencies
├── tsconfig.json         # strict, NodeNext module resolution
└── evolution_docs/       # This file and the journey
```

## Each File Explained

### `src/server.ts`

```ts
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import uploadRouter from './routes/upload.js';

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use('/upload', uploadRouter);

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Max 5MB.' });
    }
  }
  res.status(400).json({ error: err?.message || 'Upload failed' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`M06 server running on http://localhost:${PORT}`);
  });
}

export default app;
```

- Creates `uploads/` directory on boot
- Serves uploaded files statically
- Global error handler translates multer errors to HTTP status codes

### `src/middleware/upload.ts`

```ts
import multer from 'multer';

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

- `memoryStorage` keeps files in RAM for inspection before writing
- `fileSize: 5 * 1024 * 1024` limits to 5MB
- `fileFilter` checks MIME type (but clients can lie)

### `src/routes/upload.ts`

```ts
import { Router } from 'express';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.originalname}`;

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    size: req.file.size,
  });
});

export default router;
```

- Constructs a URL assuming the file is on disk
- Returns file metadata in the response

## The Intentional Bug

`multer.memoryStorage()` buffers the entire file in RAM. The route constructs a URL `/uploads/${req.file.originalname}` and returns it. But with `memoryStorage`, the file is never written to disk. The URL returns 404.

Worse: if someone uploads a 5MB file, it stays in RAM. If 100 users upload simultaneously, that's 500MB of RAM. If they upload 100MB files (if the limit were higher), the process crashes.

**Fix:** Use `multer.diskStorage()` to write files to disk, or stream the buffer to disk after validation:

```ts
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});
```

And generate the URL from the actual saved path, not `originalname`.

## Running It

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

## Why This Matters

File uploads are an attack surface. Memory storage is convenient for small files but dangerous for concurrent uploads. A single config change (`memoryStorage` → `diskStorage`) determines whether your app is stable or crashes under load.

The bug is intentional. Find it. Fix it. The lesson: convenience in development often becomes a vulnerability in production.
