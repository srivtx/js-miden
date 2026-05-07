# M06 File Uploader: Fundamentals

## 1. What Makes File Upload Dangerous?

File upload is unique among HTTP operations because it:
- Accepts **binary data** you cannot inspect by reading the payload.
- Expands the **attack surface** to the filesystem.
- Often runs with **sufficient privileges** to write executable code.
- Is a **distribution vector** for malware, illegal content, and phishing assets.

Every file upload endpoint is a potential door into your server.

## 2. The Trust Chain

When a user uploads a file, you receive:

| Field | Source | Trust Level |
|-------|--------|-------------|
| `file.originalname` | Client | **Zero trust** — can be `../../../etc/passwd` |
| `file.mimetype` | Client | **Zero trust** — browser sends this; easily spoofed |
| `file.size` | Client / Multer | **Partial trust** — Multer enforces limits, but verify |
| File content (bytes) | Client | **Zero trust** — must validate server-side |

> **Rule:** Treat every uploaded file as potentially hostile until proven otherwise.

## 3. Filename Sanitization

### Path Traversal
A malicious client sends:
```
Content-Disposition: form-data; name="image"; filename="../../../app/server.js"
```

If saved directly, this **overwrites your application code**.

### Defense
- **Generate filenames yourself:** `crypto.randomUUID() + ext`
- **Strip path separators:** `filename.replace(/[\/\\]/g, '')`
- **Restrict length:** Max 255 characters.
- **Whitelist extensions:** Only allow `.jpg`, `.png`, `.gif`.

## 4. MIME Type vs Magic Numbers

### MIME Type (Untrusted)
The `Content-Type` header sent by the browser:
```
Content-Type: image/jpeg
```

Any client can send `image/jpeg` for an `.exe` file.

### Magic Numbers (Trusted)
The actual bytes at the start of the file:

| Type | Magic Bytes (hex) |
|------|-------------------|
| JPEG | `FF D8 FF` |
| PNG  | `89 50 4E 47` |
| GIF  | `47 49 46 38` |
| PDF  | `25 50 44 46` |
| EXE  | `4D 5A` |

### Defense
Validate both MIME type (coarse filter) and magic numbers (fine filter):
```javascript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAGIC = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
};

function validateFile(filePath, mimetype) {
  if (!ALLOWED_TYPES.includes(mimetype)) return false;
  const buffer = fs.readFileSync(filePath);
  const magic = MAGIC[mimetype];
  return magic.every((byte, i) => buffer[i] === byte);
}
```

## 5. Storage Strategies

| Strategy | How | Use Case |
|----------|-----|----------|
| **Memory** (`multer.memoryStorage`) | Buffer in RAM | Tiny files, immediate processing (e.g., thumbnail generation) |
| **Disk** (`multer.diskStorage`) | Stream to filesystem | Default; files must persist |
| **Cloud** (S3, GCS) | Stream directly to cloud | Production; scalable; no local disk exhaustion |

**Danger:** `memoryStorage` with large files and concurrent uploads = OOM crash.

## 6. Size Limits

Without limits, an attacker uploads a 100 GB file and exhausts disk or memory.

```javascript
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
```

Multer throws a `MulterError` if the limit is exceeded. Catch it:
```javascript
app.post('/upload', upload.single('image'), (req, res) => {
  // success
}, (err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  next(err);
});
```

## 7. Serving Uploaded Files

### Dangerous: Direct Static Serving
```javascript
app.use('/uploads', express.static('uploads'));
```
This serves every file blindly. If someone uploads HTML with JavaScript, it executes in your domain (XSS). If they upload a PHP shell and your server runs PHP, you are compromised.

### Safer: Controller-Mediated Serving
```javascript
app.get('/uploads/:filename', authenticateUser, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  // Prevent path traversal
  if (!filePath.startsWith(UPLOAD_DIR)) {
    return res.status(403).send('Forbidden');
  }
  res.sendFile(filePath);
});
```

Even safer: serve from a separate domain (`cdn.example.com`) with `Content-Disposition: attachment` and strict `Content-Type` headers.

## 8. The Fundamental Truth

> File upload security is not about finding the one perfect validation. It is about **layering defenses** so that even if one layer fails, the next one catches the attack. Sanitize the name. Check the type. Verify the magic bytes. Limit the size. Store outside the webroot. Serve through a controller. Scan with antivirus. No single layer is enough. Together, they form a wall.
