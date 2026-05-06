# 03-CONCEPTS.md — File Uploader (M06)

## 1. Multipart Form Data

### WHAT

`multipart/form-data` is an HTTP content type for submitting files and mixed data types in a single request. It splits the payload into "parts," each with its own headers.

### WHY

Binary files cannot be safely encoded in `application/x-www-form-urlencoded` (which is text-only and has length limits). Multipart allows raw binary to travel alongside text fields.

### HOW

```http
POST /upload HTTP/1.1
Host: localhost:3000
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="image"; filename="photo.png"
Content-Type: image/png

<binary data>
------WebKitFormBoundary
Content-Disposition: form-data; name="description"

My vacation photo
------WebKitFormBoundary--
```

Each part is delimited by the `boundary` string. The server (or middleware like `multer`) parses this stream, extracting each part's headers and body.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Parse multipart manually with string splitting | Use battle-tested middleware (`multer`, `busboy`, `formidable`) |
| Ignore `Content-Type` boundaries | Validate boundary string to prevent parser confusion |
| Buffer entire multipart body before parsing | Stream parts as they arrive |

---

## 2. Streams vs Buffers

### WHAT

| | Buffer | Stream |
|---|--------|--------|
| **Definition** | A contiguous chunk of memory holding all data. | A sequence of data chunks flowing over time. |
| **Memory** | Proportional to total data size. | Bounded (one chunk at a time). |
| **Latency** | Must receive everything before processing. | Process starts as soon as first chunk arrives. |
| **Use case** | Small config files, JSON payloads. | Large files, real-time data, video. |

### WHY

Node.js is built on streams. The HTTP request object itself is a `Readable` stream. When you do:

```typescript
const chunks: Buffer[] = [];
req.on('data', chunk => chunks.push(chunk));
req.on('end', () => {
    const buffer = Buffer.concat(chunks); // All data in memory
});
```

You are converting a stream into a buffer. For a 5 MB upload, that's fine. For a 5 GB upload, that's a crash.

### HOW: `readable.pipe(writable)` and Backpressure

```typescript
import { createReadStream, createWriteStream } from 'fs';

const readable = createReadStream('large-file.zip');
const writable = createWriteStream('output.zip');

readable.pipe(writable);
```

**Backpressure:**
When the writable stream (disk) is slower than the readable stream (network), the writable's internal buffer fills up. It signals `false` to `readable.write()`. The readable pauses until the writable emits `drain`.

```
Network (fast) ──► readable ──► pipe() ──► writable ──► Disk (slow)
                                    ▲
                                    └── writable says "pause!"
```

This is automatic with `.pipe()`. Without it, memory grows unbounded.

In `multer.diskStorage()`, the incoming request stream is piped directly to a `fs.WriteStream`. Backpressure ensures memory stays flat regardless of file size.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `Buffer.concat(chunks)` for any user-uploaded file | Stream to disk with `fs.createWriteStream()` |
| Ignore backpressure signals | Use `.pipe()` or handle `drain` events manually |
| Store large files in `Buffer` for "simplicity" | Accept the complexity of streams; memory is not infinite |

---

## 3. MIME Types vs File Extensions

### WHAT

| | MIME Type | File Extension |
|---|-----------|----------------|
| **Source** | HTTP `Content-Type` header or magic numbers | Filename suffix (`.jpg`) |
| **Trust** | Client-declared (untrusted) or file-inspected (trusted) | Client-provided (untrusted) |
| **Purpose** | Tells the browser how to render the file. | Hints the OS about which program to open. |

### WHY

Both are metadata, not data. A file named `photo.jpg` with `Content-Type: image/jpeg` can still be an executable if the bytes are `MZ` (Windows EXE header).

### HOW: Magic Numbers

Magic numbers are byte signatures at the start of a file:

| Type | Hex Signature | ASCII |
|------|---------------|-------|
| JPEG | `FF D8 FF` | ÿØÿ |
| PNG | `89 50 4E 47` | .PNG |
| GIF | `47 49 46 38` | GIF8 |
| PDF | `25 50 44 46` | %PDF |
| ZIP / JAR | `50 4B 03 04` | PK.. |

In Node.js:

```typescript
import { fileTypeFromBuffer } from 'file-type';

const type = await fileTypeFromBuffer(buffer);
// type = { ext: 'png', mime: 'image/png' }
```

**Workflow:**
1. `multer` streams file to disk.
2. Read first 4,112 bytes (minimum for `file-type`).
3. Validate magic number against whitelist.
4. If mismatch, delete file and reject.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `if (file.originalname.endsWith('.png'))` | `if ((await fileTypeFromBuffer(buf)).mime === 'image/png')` |
| Trust `file.mimetype` from multer alone | Add magic-number validation in production |
| Rename `.exe` to `.jpg` and accept it | Reject if magic number does not match declared type |

---

## 4. Path Traversal Attacks

### WHAT

An attacker manipulates a filename parameter to access files outside the intended directory.

### WHY

Web servers often construct file paths dynamically:
```typescript
const path = './uploads/' + filename;
```

If `filename` is `../../../etc/passwd`, the resolved path is `/etc/passwd`.

### HOW: The Attack Diagram

```
Intended directory:
  /app/
    uploads/          <-- safe zone
      photo.png

Malicious filename:  ../../../etc/passwd

Path resolution:
  /app/uploads/../../../etc/passwd
  = /etc/passwd       <-- escaped safe zone!
```

Even without directory traversal, an attacker might upload:
- `shell.php.jpg` (if Apache mod_php executes based on first extension).
- `.htaccess` (to override server config).
- `web.config` (IIS configuration injection).

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `fs.writeFile('./uploads/' + originalname, data)` | `fs.writeFile(path.join(uploadsDir, uuid + ext), data)` |
| Sanitize by stripping `../` (bypassable: `....//`) | Never use user input in filesystem paths |
| Trust `path.normalize()` alone | Generate filenames server-side with UUIDs |
| Allow uploads to web root | Store uploads outside web root or serve via middleware |

### DIAGRAM: Safe vs Unsafe Filename Handling

```
CLIENT                    SERVER
  │                        │
  │  filename="../../../"  │
  │ ──────────────────────►│
  │                        │ ┌──────────────────┐
  │                        │ │ 1. Reject or     │
  │                        │ │    sanitize input│
  │                        │ └──────────────────┘
  │                        │          │
  │                        │          ▼
  │                        │ ┌──────────────────┐
  │                        │ │ 2. Generate UUID │
  │                        │ │    filename      │
  │                        │ └──────────────────┘
  │                        │          │
  │                        │          ▼
  │                        │ ┌──────────────────┐
  │                        │ │ 3. Write to      │
  │                        │ │    /uploads/     │
  │                        │ │    <uuid>.png    │
  │                        │ └──────────────────┘
  │                        │
  │  { url: "/uploads/..."}│
  │ ◄──────────────────────│
```

## SOURCES

- [OWASP — Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [Node.js Docs — Stream](https://nodejs.org/api/stream.html)
- [Mozilla — MIME Types](https://developer.mozilla.org/en-US/docs/Web/HTTP/MIME_types)
- `file-type` npm package documentation.
