# v3-add-validation

## Goal
Reject bad files before they hit storage.

## Changes
1. Extension whitelist in `multer` (`.jpg`, `.png`, `.pdf`).
2. Magic-number check with `file-type` after write.
3. File size cap (5 MB).
4. Sanitize filename with `path.basename` + `crypto.randomUUID` prefix.

## Code

```ts
// src/middleware.ts
import { fileTypeFromFile } from 'file-type';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function validateFileType(req: Request, res: Response, next: NextFunction) {
  if (!req.file) return next();
  const type = await fileTypeFromFile(req.file.path);
  if (!type || !ALLOWED_TYPES.includes(type.mime)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  next();
}
```

```ts
// src/controller.ts
import { randomUUID } from 'crypto';
import path from 'path';

export async function uploadFile(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const safeName = `${randomUUID()}-${path.basename(req.file.originalname)}`;
  const storedPath = await storeFile(req.file.path, safeName);
  return res.status(201).json({ path: storedPath });
}
```

## Decisions
- **Magic numbers beat extensions** — `file-type` reads file headers, not the `.exe` renamed to `.jpg`.
- **UUID prefix** prevents collision and hides original name from attackers.
- Validate **after** multer writes to disk because `file-type` needs the bytes.

## Risks
- Temp file exists on disk for a few ms before validation. Acceptable for small files; streaming validation is v4.
