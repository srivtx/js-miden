# v3-add-validation.md — "Users send garbage data"

## The Bug

Your file uploader checks file extensions:

```ts
const upload = multer({
  dest: 'uploads/',
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.jpg')) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg allowed'));
    }
  },
});
```

A user renames `malware.exe` to `malware.jpg` and uploads it. The extension check passes. The file is stored as `.jpg`. A misconfigured web server executes it as a CGI script.

Extension checks validate the **name**, not the **content**.

## The 3am Page, Redux

Someone uploads a 50MB "profile picture." Your server buffers the entire file to disk before the extension check even runs. The disk fills up. The server stops responding. The extension check was supposed to prevent this, but it ran *after* the file was already written.

You also get a file with `mimetype: image/jpeg` in the multer object, but when you open it, it's a text file containing a phishing URL. The client lied about the MIME type, and you trusted it.

## Adding Real Validation

### Step 1: Magic Numbers

Files have **magic numbers** — byte sequences at the start that identify the real format:

- JPEG: `FF D8 FF`
- PNG: `89 50 4E 47`
- GIF: `47 49 46 38`

```ts
// src/validation.ts
import { z } from 'zod';

export const allowedMagicNumbers: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  'image/gif': Buffer.from([0x47, 0x49, 0x46, 0x38]),
};

export function validateFileType(buffer: Buffer): string | null {
  for (const [mime, magic] of Object.entries(allowedMagicNumbers)) {
    if (buffer.slice(0, magic.length).equals(magic)) {
      return mime;
    }
  }
  return null;
}
```

### Step 2: Multer Config with Validation

```ts
// src/middleware/upload.ts
import multer from 'multer';
import { validateFileType } from '../validation.js';

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

### Step 3: Route-Level Content Check

```ts
// src/routes/upload.ts
import { validateFileType } from '../validation.js';

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const actualType = validateFileType(req.file.buffer);
  if (!actualType) {
    return res.status(400).json({ error: 'File content does not match allowed types' });
  }

  // Now we know the file is really what it claims to be
  const fileUrl = `/uploads/${req.file.originalname}`;
  res.json({ message: 'File uploaded', url: fileUrl, size: req.file.size });
});
```

Now:

- `malware.jpg` (actually an `.exe`) → magic number check fails → 400
- `phishing.html` with `Content-Type: image/jpeg` → magic number check fails → 400
- A real JPEG → passes both checks → 200

## Why Memory Storage?

For small files (under 5MB), `memoryStorage` keeps the file in RAM. We can inspect the buffer before writing to disk. If validation fails, we never touch the disk. No temp files. No disk exhaustion from rejected uploads.

For large files, we'd use streaming. But for profile pictures, memory storage is fine.

## What Changed

- Added magic number validation to verify actual file content
- MIME type check catches obvious lies
- Size limit prevents disk/RAM exhaustion
- Validation runs *before* persisting the file

## What We Still Need

Validation stops bad files. But when uploads fail, or the disk is full, or a client complains that uploads are slow, we have no logs. We can't trace which request failed or why.

For that, we need structured logging.
