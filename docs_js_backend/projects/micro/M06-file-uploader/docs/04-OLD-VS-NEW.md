# 04-OLD-VS-NEW.md — File Uploader (M06)

## Old Patterns (Pre-2010)

### 1. CGI Scripts Writing to Web Root

**WHAT:** Perl/CGI scripts accepted uploads and wrote them directly into `public_html/uploads/`.

**WHY it was common:** Shared hosting was the only option; no concept of app server vs web server.

**WRONG today:** Uploads in the web root are directly executable if the filename has `.php`, `.jsp`, or `.asp`. An attacker uploads `shell.php` and visits `/uploads/shell.php` to execute it.

---

### 2. Extension-Only Validation

**WHAT:** `if ($filename =~ /\.(jpg|png|gif)$/i)` in Perl or PHP.

**WHY it was used:** Simple regexes were the fastest way to "validate."

**WRONG today:** Extensions are client-controlled metadata. Double extensions (`shell.php.jpg`) and null-byte truncation (`photo.jpg%00.php`) bypass regex checks.

---

### 3. Synchronous Buffering in PHP

**WHAT:** `file_get_contents('php://input')` or `$_FILES['file']['tmp_name']` loaded the entire upload into memory.

**WHY it was wrong:** PHP's default `memory_limit` is 128 MB. A few concurrent uploads crashed the process.

**RIGHT today:** Stream uploads directly to disk or cloud storage. Never buffer large files in memory.

---

## Modern Patterns (2020+)

### 1. Stream-to-Cloud (S3 / GCS / R2)

**WHAT:** Use `busboy` or `multer-s3` to stream multipart parts directly to object storage via signed URLs.

**WHY it is right:**
- No disk I/O on the app server.
- Unlimited scale (cloud storage handles the bandwidth).
- Virus scanning and CDN integration are native.

---

### 2. Magic Number Validation

**WHAT:** Libraries like `file-type`, `magic-bytes.js`, or `libmagic` (Unix `file` command) inspect file headers.

**WHY it is right:** It is the only server-side validation that inspects the actual payload.

---

### 3. Signed URLs for Downloads

**WHAT:** Instead of serving `/uploads/<uuid>`, generate a time-limited signed URL: `https://cdn.example.com/<uuid>?signature=...&expires=...`.

**WHY it is right:** Prevents hotlinking, allows access control, and offloads bandwidth to a CDN.

---

### 4. Serverless / Ephemeral Upload Handlers

**WHAT:** AWS Lambda or Cloudflare Workers handle the upload, stream to S3, and return the URL.

**WHY it is right:** No persistent server to compromise. If an attacker breaks the upload handler, there is no local filesystem to escape into.

---

### 5. Content Security Policy (CSP) for Uploaded Content

**WHAT:** Serve uploads from a separate domain (`assets.example.com`) with `Content-Disposition: attachment` and strict CSP headers.

**WHY it is right:** Even if an attacker uploads HTML with XSS or JavaScript, the browser refuses to execute it due to CSP.

---

## Comparison Table

| Era | Storage | Validation | Filename | Serving |
|-----|---------|------------|----------|---------|
| 2005 | Web root (`public_html`) | Extension regex | Original name | Direct URL |
| 2015 | Local disk outside web root | MIME type + size | Sanitized | Static middleware |
| 2024 | Cloud object storage | Magic numbers + MIME | UUID | Signed CDN URLs + CSP |

## WRONG vs RIGHT

| WRONG (Old) | RIGHT (Modern) |
|-------------|----------------|
| Upload to web root | Upload outside web root or to cloud storage |
| Extension whitelist only | Magic number validation |
| Original filename in URL | UUID or hash-based filename |
| Direct static serving | Signed URLs or authenticated controller |
| No size limits | Server-level + middleware + proxy limits |
| Synchronous buffering | Streaming with backpressure |

## SOURCES

- [OWASP — Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- AWS Docs, "S3 Presigned URLs."
- Mozilla, "Content Security Policy (CSP)."
