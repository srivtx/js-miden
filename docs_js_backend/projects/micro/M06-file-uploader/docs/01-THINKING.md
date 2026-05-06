# 01-THINKING.md — File Uploader (M06)

## Mental Model: The Customs Checkpoint

Imagine an airport customs checkpoint. Every passenger (file) must:
1. Pass through a scanner (multipart parser).
2. Have their passport checked (MIME type validation).
3. Have luggage weighed (size limit).
4. Be assigned a secure locker (disk storage with safe filename).
5. Receive a receipt with the locker number (public URL).

If any step fails, the passenger is rejected **before** entering the country.

## The Hot Path

Every upload triggers:

```
1. HTTP request hits POST /upload
2. Multer parses multipart stream
3. fileFilter checks MIME type against whitelist
4. limits.fileSize checked during streaming
5. diskStorage writes chunks to uploads/<uuid>.<ext>
6. Route handler constructs URL and responds
7. Express static serves file on subsequent GET
```

**The hot path is the streaming write.** Disk I/O is the bottleneck, not CPU. Memory must remain bounded regardless of file size.

## Danger Zones

### 1. Memory Exhaustion (The Bug)
If `multer.memoryStorage()` is used, the entire file is buffered in a `Buffer` in the V8 heap. Concurrent uploads of large files can:
- Exceed the default 1.4 GB (64-bit) or 512 MB (32-bit) heap limit.
- Trigger `FATAL ERROR: JavaScript heap out of memory`.
- Crash the process, dropping all active connections.

**Mitigation:** Always use `diskStorage` for files that must persist.

### 2. Path Traversal
A malicious `originalname` like `../../../etc/cron.d/payload` could escape the `uploads/` directory if the server naively uses it as a path. Even on Windows, `..\..\windows\system32\...` is dangerous.

**Mitigation:** Generate filenames with `crypto.randomUUID()`; discard or heavily sanitize `originalname`.

### 3. MIME Type Spoofing
A client can send `Content-Type: image/png` while the payload is actually a PHP script or executable. Multer only checks the declared MIME type.

**Mitigation:** Read magic numbers (file signatures) with a library like `file-type` or `magic-bytes.js`.

### 4. Slowloris-style Upload
An attacker opens many connections and sends data very slowly, keeping connections open and exhausting the connection pool.

**Mitigation:** Set server-level timeouts (`server.timeout`, `server.headersTimeout`) and use a reverse proxy (Nginx) with stricter timeouts.

### 5. Disk Exhaustion
If uploads are never cleaned up, disk fills. This is a silent, creeping failure.

**Mitigation:** Cron job or lifecycle policy to delete files older than N days. Log disk usage alerts.

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `memoryStorage` for anything that must persist | `diskStorage` for persistence; `memoryStorage` only for temporary processing |
| Trust `file.mimetype` alone | Validate magic numbers in production |
| Use `file.originalname` directly as the path | Generate UUID filenames; sanitize any user input in paths |
| No size limit | Enforce `limits.fileSize` in multer + reverse proxy |
| Store uploads in project root (`./uploads`) | Store outside web root or serve via controlled static middleware |
| No cleanup policy | Automated lifecycle deletion + disk monitoring |

## Key Insight

> File uploads are **I/O-bound, untrusted, and irreversible**. Stream to disk immediately, validate aggressively, and never trust client-provided metadata.

## SOURCES

- [OWASP — Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- Node.js docs, "Buffer" and "Stream" modules.
