# S10 File Sharing — Security

## Path Traversal (Critical)

The storage layer trusts the user-provided filename:
```typescript
const key = filename;
const filePath = path.join(UPLOAD_DIR, key);
fs.writeFileSync(filePath, buffer);
```

### Exploits
1. **Write outside upload directory**
   ```json
   { "filename": "../../../etc/cron.d/backdoor", "file": "..." }
   ```
2. **Overwrite existing files**
   ```json
   { "filename": "../../src/index.ts", "file": "..." }
   ```
3. **Read arbitrary files via download**
   If the attacker knows a token mapped to `../../../etc/passwd`, the download endpoint reads it.

### Remediation
1. **UUID prefix + basename sanitization**
   ```typescript
   const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
   const key = `${uuidv4()}-${safe}`;
   ```
2. **Resolved path validation**
   ```typescript
   const resolved = path.resolve(UPLOAD_DIR, key);
   if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
     throw new Error('Path traversal detected');
   }
   ```
3. **Containerization**: Run the app in a container with `UPLOAD_DIR` as the only writable volume.

## Missing Expiration Enforcement

Tokens are generated with a 24-hour expiry, but the download endpoint never checks it. This violates the **principle of least astonishment** and can lead to data leaks if a shared link was intended to be temporary.

### Fix
```typescript
if (Date.now() > row.expires_at) {
  // Optional: delete file and row
  return res.status(410).json({ error: 'Gone' });
}
```

## Information Disclosure

The `info` endpoint leaks the `expires_at` timestamp and `download_count`. While not critical, it reveals:
- How popular a file is.
- When the link will die (helpful for attackers planning data exfiltration).

Consider requiring authentication or a secondary signature to access `info`.

## Denial of Service

- **Large uploads**: Base64 encoding inflates file size by 33%. A 100 MB upload becomes ~133 MB of JSON, exhausting memory during parsing.
  - **Fix**: Limit body size (`express.json({ limit: '5mb' })`) or switch to streaming multipart.
- **Disk exhaustion**: No cleanup job means uploads accumulate forever.
  - **Fix**: Cron job or lifecycle rules on object storage.
- **Token enumeration**: UUIDv4 has 122 bits of entropy, making brute-force enumeration infeasible. If tokens were sequential integers, an attacker could harvest all files.

## MIME Type & Content Sniffing

The download endpoint sends `Content-Type: application/octet-stream`. This is safe because it prevents the browser from interpreting the file as HTML or JavaScript. Never send `Content-Type` based on user input (e.g., trusting the file extension) without validation, as it can lead to XSS via file upload.
