# 08-CRITIQUE.md — File Uploader (M06)

## Senior Engineer Review

### Overall Assessment

This is a **minimal but effective** teaching project. It demonstrates the single most dangerous mistake in file upload handling: using `memoryStorage` when `diskStorage` is required. The bug is clear, the test catches it, and the fix is straightforward. However, several production concerns are missing.

### Strengths

1. **Clear, Reproducible Bug**
   The test "should save the uploaded file to local disk" fails in a way that immediately reveals the issue. This is excellent pedagogy.

2. **MIME Type Filter as Baseline**
   ```typescript
   const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
   ```
   While insufficient alone, it is a necessary first line of defense and correctly rejects obviously wrong types.

3. **Size Limit Enforcement**
   ```typescript
   limits: { fileSize: 5 * 1024 * 1024 }
   ```
   Multer enforces this during streaming, so even a 10 GB upload is aborted after 5 MB + buffer overhead.

4. **Error Handler for Multer Errors**
   ```typescript
   if (err instanceof multer.MulterError) {
     if (err.code === 'LIMIT_FILE_SIZE') {
       return res.status(413).json({ error: 'File too large. Max 5MB.' });
     }
   }
   ```
   Good UX: clients get a clear message instead of a generic 500.

### Weaknesses

1. **Memory Storage is the Default**
   ```typescript
   const storage = multer.memoryStorage();
   ```
   This is the **intentional bug**, but in a real codebase this would be a P0 incident. The risk is not just missing files—it is **process crash** under concurrent load.

2. **Trusts `originalname` for the URL**
   ```typescript
   const fileUrl = `/uploads/${req.file.originalname}`;
   ```
   Even if `diskStorage` were used, this is dangerous. `originalname` can contain path traversal sequences (`../../../etc/passwd`) or null bytes. While `multer` sanitizes some of this, relying on it is risky.

3. **No Magic Number Validation**
   A client can rename `shell.php` to `photo.jpg` and set `Content-Type: image/jpeg`. The server accepts it. In production, this is a remote code execution vector if the file is ever executed.

4. **Uploads Directory in Project Root**
   ```typescript
   const uploadsDir = path.join(process.cwd(), 'uploads');
   ```
   Fine for development, but in production, use a dedicated volume or cloud storage. Also, no cleanup policy means disk exhaustion over time.

5. **Static Serving Without Content-Type Validation**
   ```typescript
   app.use('/uploads', express.static(uploadsDir));
   ```
   If an attacker somehow uploads `.html` or `.js`, the browser will execute it. Serving user content from the same origin is an XSS risk.

6. **No Rate Limiting on Upload Endpoint**
   An attacker can upload thousands of 5 MB files, filling disk even if each individual file is small.

### Code Smells

| Smell | Location | Severity |
|-------|----------|----------|
| `memoryStorage` | `upload.ts` | Critical (intentional bug) |
| `req.file.originalname` in URL | `upload.ts` | High |
| No magic number check | `upload.ts` | High |
| No upload rate limiting | `server.ts` | Medium |
| `process.cwd()` for paths | `server.ts` | Low (dev only) |

### What Would Make This Production-Grade

1. **Switch to `diskStorage` with UUID filenames** (see `05-BUILD.md`).
2. **Add magic number validation** using `file-type` or `magic-bytes.js`.
3. **Serve uploads from a separate domain** (`assets.example.com`) with `Content-Disposition: attachment`.
4. **Add CSP headers** to prevent execution of uploaded HTML/JS.
5. **Implement rate limiting** on `/upload` (M05 project!).
6. **Add virus scanning** via ClamAV or cloud-native solutions (AWS Macie, Cloudmersive).
7. **Use cloud storage** (S3) with lifecycle policies instead of local disk.
8. **Log and monitor** upload volume, rejected file types, and disk usage.

### Final Verdict

> **B+ as a teaching project. F as production code.**
>
> The `memoryStorage` bug is the perfect lesson in why streaming matters. However, a production file uploader needs defense in depth: magic numbers, UUID filenames, separate domains, rate limits, and automated cleanup.

## WRONG vs RIGHT

| Wrong (Current) | Right (Production) |
|-----------------|--------------------|
| `memoryStorage` for persistence | `diskStorage` or direct-to-cloud |
| `originalname` in URL | UUID + validated extension |
| MIME type only | Magic numbers + MIME + extension |
| Same-origin static serving | Separate asset domain + CSP |
| No upload rate limits | Rate limit + size limit + per-user quotas |
| Local disk forever | Cloud storage + lifecycle deletion |

## SOURCES

- Author's own review based on production file handling experience.
- OWASP, "Unrestricted File Upload" and "Path Traversal."
- Snyk Research, "File Upload Vulnerabilities," 2023.
- Mozilla, "Content Security Policy."
