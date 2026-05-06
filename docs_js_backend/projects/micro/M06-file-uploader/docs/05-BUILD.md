# 05-BUILD.md — File Uploader (M06)

## Step-by-Step Build

### Prerequisites

- Node.js 20+
- npm or pnpm

---

### Step 1: Project Scaffold

```bash
mkdir M06-file-uploader && cd M06-file-uploader
npm init -y
npm install express multer
npm install -D typescript @types/express @types/multer @types/node vitest supertest @types/supertest tsx
```

---

### Step 2: TypeScript Configuration

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

### Step 3: Upload Middleware

Create `src/middleware/upload.ts`:

```typescript
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// BUG: Using memoryStorage instead of diskStorage.
// Files are buffered entirely in RAM rather than being streamed to disk.
// This means:
//   1. Uploaded files disappear after the request ends.
//   2. Concurrent large uploads can exhaust memory and crash the process.
// ---------------------------------------------------------------------------
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
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

---

### Step 4: Upload Route

Create `src/routes/upload.ts`:

```typescript
import { Router } from 'express';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // BUG: With memoryStorage, this URL points to nothing.
  const fileUrl = `/uploads/${req.file.originalname}`;

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    size: req.file.size,
  });
});

export default router;
```

---

### Step 5: Server

Create `src/server.ts`:

```typescript
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

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Max 5MB.' });
    }
  }
  res.status(400).json({ error: err?.message || 'Upload failed' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`M06 server running on http://localhost:${PORT}`));
}

export default app;
```

---

### Step 6: Tests

Create `tests/upload.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/server.js';

const uploadsDir = path.join(process.cwd(), 'uploads');

describe('POST /upload', () => {
  beforeAll(() => {
    if (fs.existsSync(uploadsDir)) fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(uploadsDir)) fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('should save the uploaded file to local disk', async () => {
    const fileName = 'test-image.png';
    const filePath = path.join(uploadsDir, fileName);

    const res = await request(app)
      .post('/upload')
      .attach('image', Buffer.from('fake-image-data'), fileName);

    expect(res.status).toBe(200);
    // THIS WILL FAIL because memoryStorage does not write to disk
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should reject files larger than 5MB', async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    const res = await request(app).post('/upload').attach('image', largeBuffer, 'large.png');
    expect(res.status).toBe(413);
  });
});
```

---

### Step 7: Run

```bash
npm run dev    # tsx src/server.ts
npm test       # vitest
```

---

### Step 8: The Fix (diskStorage)

Replace `src/middleware/upload.ts`:

```typescript
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif'].includes(ext) ? ext : '';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});
```

Update `src/routes/upload.ts` to use `req.file.filename`:

```typescript
const fileUrl = `/uploads/${req.file.filename}`;
```

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `multer.memoryStorage()` for persistence | `multer.diskStorage()` for files that must survive |
| `req.file.originalname` in the URL | `req.file.filename` (UUID) in the URL |
| No cleanup of `uploads/` directory | Automated cleanup or lifecycle policies |
| Only MIME type validation | Add magic-number validation in production |

## SOURCES

- Multer documentation.
- Node.js `fs` and `stream` documentation.
- OWASP File Upload guidelines.
