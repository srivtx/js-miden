# 06-BUGS

## Intentional Bug: Path Traversal in Filename

### Description
The upload controller uses `req.file.originalname` directly as the destination filename when calling `storeFile`. No sanitization is applied. An attacker can upload a file named `../../../etc/passwd` and write outside the intended `uploads/` directory.

### Location
`src/controller.ts`:
```typescript
const filename = req.file.originalname;
const storedPath = await storeFile(req.file.path, filename);
```

### Real-World Impact
- Arbitrary file overwrite on the server filesystem.
- If the app runs as root, system files can be replaced.
- Combined with executable extensions (e.g., `.php`, `.jsp`), can lead to RCE on misconfigured servers.
- Even with local storage only, reading sensitive files via `GET /uploads/../../../etc/passwd` is possible.

### Fix
```typescript
import path from 'path';
import { randomUUID } from 'crypto';
const safeName = randomUUID() + path.extname(req.file.originalname);
```
