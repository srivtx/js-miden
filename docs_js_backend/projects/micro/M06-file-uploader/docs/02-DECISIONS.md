# 02-DECISIONS.md — File Uploader (M06)

## 1. Memory Storage vs Disk Storage

### WHAT

| Strategy | How It Works | Memory Bound | File Persists | Use Case |
|----------|--------------|--------------|---------------|----------|
| `memoryStorage` | Buffers entire file into a `Buffer` in V8 heap | No (scales with file size) | No | Temporary processing (image resize, virus scan) |
| `diskStorage` | Streams chunks directly to filesystem | Yes (bounded by OS buffers) | Yes | Persistence, static serving |

### WHY

Node.js runs in a single process with a fixed heap size (default ~1.4 GB on 64-bit). Each `memoryStorage` upload allocates a `Buffer` proportional to the file size. Under concurrent load:

```
10 concurrent uploads × 5 MB = 50 MB
100 concurrent uploads × 5 MB = 500 MB
100 concurrent uploads × 50 MB = 5 GB → CRASH
```

Disk storage delegates memory pressure to the OS page cache and filesystem buffers, which are far more efficient at managing large transient data.

### DECISION

**Use `diskStorage`.** The bug in this project intentionally uses `memoryStorage` to demonstrate the crash risk. The fix is to switch to `diskStorage` with a UUID filename.

## 2. File Type Validation Methods

### WHAT

| Method | What It Checks | Trust Level |
|--------|----------------|-------------|
| **File extension** | `photo.jpg` → `.jpg` | **Untrusted** — trivially spoofed by renaming |
| **MIME type** | `Content-Type: image/jpeg` header | **Untrusted** — sent by client, easily forged |
| **Magic numbers** | First bytes of file: `FF D8 FF` = JPEG | **Trusted** — inspects actual file content |

### WHY

An attacker can rename `malware.exe` to `photo.jpg` and set `Content-Type: image/jpeg`. If the server only checks extension or MIME, the executable is accepted.

Magic numbers (file signatures) are the only server-side validation that inspects the payload itself. Libraries like `file-type` or `magic-bytes.js` read the first few bytes and match against a known database.

### DECISION

For this micro project, use **MIME type whitelist** in `multer.fileFilter` as a baseline. The documentation explicitly warns that production code must add magic-number validation.

```typescript
// Baseline (project uses this)
if (allowedTypes.includes(file.mimetype)) { ok }

// Production addition
import { fileTypeFromBuffer } from 'file-type';
const type = await fileTypeFromBuffer(buffer);
if (!type || !allowedTypes.includes(type.mime)) { reject }
```

## 3. Filename Handling

### WHAT

The client provides `originalname`. The server must decide what to call the file on disk.

### WHY

Using `originalname` directly is dangerous:
- Path traversal: `../../../etc/passwd`
- Overwrite attacks: `existing-file.png` (if no UUID)
- Unicode attacks: Null bytes, right-to-left override characters
- OS reserved names: `CON`, `PRN`, `NUL` on Windows

### DECISION

Generate a **UUID + validated extension**:

```typescript
const ext = path.extname(file.originalname).toLowerCase();
const safeExt = ['.jpg', '.jpeg', '.png', '.gif'].includes(ext) ? ext : '';
const filename = `${crypto.randomUUID()}${safeExt}`;
```

This:
- Guarantees uniqueness (no overwrites).
- Strips path separators (`/`, `\`, `..`).
- Preserves a type hint for the extension.
- Never executes client-provided names.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `fs.writeFileSync('./uploads/' + file.originalname, buffer)` | `fs.writeFileSync(path.join(uploadsDir, uuid + ext), buffer)` |
| Trust `originalname` for the static URL | Use the generated `filename` for the URL |
| Allow any extension | Whitelist `['.jpg', '.jpeg', '.png', '.gif']` |
| No path normalization | Use `path.basename()` or UUID generation |

## SOURCES

- [OWASP — Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [Snyk — Path Traversal](https://snyk.io/learn/directory-traversal/)
- `file-type` npm package documentation.
