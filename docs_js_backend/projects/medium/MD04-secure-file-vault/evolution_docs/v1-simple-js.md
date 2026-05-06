# MD04 Secure File Vault — v1 Simple JS

## The Naive Implementation

You need to store files. Simple:

```js
// vault.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const UPLOAD_DIR = './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.post('/upload', express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, req.body);
  res.json({ fileId: filename });
});

app.get('/download/:fileId', (req, res) => {
  const filepath = path.join(UPLOAD_DIR, req.params.fileId);
  if (!fs.existsSync(filepath)) return res.status(404).send('Not found');
  res.sendFile(path.resolve(filepath));
});

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/upload \
  --data-binary @secret.pdf \
  -H "Content-Type: application/octet-stream"
# → { "fileId": "1715097600000-abc123" }
```

## Then the Pain Hits

### 1. Path Traversal

A user requests `/download/../../../etc/passwd`. Your code joins paths blindly. You just served the server's password file.

### 2. No Encryption

Files sit on disk as plain bytes. An attacker with server access reads every upload. Medical records, tax documents, trade secrets — all naked.

### 3. No Access Control

Anyone with the fileId downloads anything. There's no concept of ownership. A user uploads a private photo. Another user guesses the ID. Privacy breach.

### 4. No Audit Trail

A sensitive file is downloaded 50 times. By whom? When? From where? You have no idea. Compliance asks for logs. You have nothing.

### 5. Memory Explosion

A user uploads a 2GB video. `express.raw()` buffers the entire thing in memory. Your Node process crashes with an out-of-memory error. The upload is lost.

## The Realization

Raw file storage is fine for a prototype. A secure vault needs:

1. **Path sanitization** — prevent directory traversal
2. **Encryption at rest** — AES-256 or similar
3. **Access control** — authentication, authorization, signed URLs
4. **Audit logging** — who did what, when
5. **Streaming** — handle large files without memory pressure
6. **Integrity checks** — verify files weren't corrupted

This is where the evolution starts.
