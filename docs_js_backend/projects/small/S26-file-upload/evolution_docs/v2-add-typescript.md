# v2-add-typescript

## Goal
Type the upload pipeline before adding validation and scanning layers.

## Changes
1. Rename `.js` → `.ts`.
2. Type `req.file` using `@types/multer`.
3. Extract `Storage` interface to prepare for S3 abstraction.

## Code

```ts
// src/services/storage.ts
export interface Storage {
  store(tempPath: string, filename: string): Promise<string>;
  retrieve(filename: string): Promise<string | null>;
}

class LocalStorage implements Storage {
  private baseDir = 'uploads';

  async store(tempPath: string, filename: string): Promise<string> {
    const dest = path.join(this.baseDir, filename);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(tempPath, dest);
    return dest;
  }

  async retrieve(filename: string): Promise<string | null> {
    const filePath = path.join(this.baseDir, filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }
}
```

## Decisions
- `Storage` interface now — prevents vendor lock-in before S3 is introduced.
- `fs.copyFile` instead of `renameSync` — async and preserves temp file for scanning.

## Risks
- Still no validation. We are only typing the danger.
