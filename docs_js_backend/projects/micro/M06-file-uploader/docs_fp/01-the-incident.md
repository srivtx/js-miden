# M06 File Uploader: The Incident

## 11:03 PM — The Shell Shock

You are the security engineer for a healthcare startup. At 11:03 PM, an AWS GuardDuty alert fires:

```
Severe: EC2 instance i-0a1b2c3d4e is communicating with a known C2 server.
```

Your file upload service. The one that lets patients upload photos of their insurance cards. Is talking to Russia.

## The Symptom

You SSH into the instance. CPU is at 4%. Network egress is steady at 2 MB/s. There is no legitimate reason for sustained upload traffic at 11 PM.

You list the running processes:

```bash
ps aux | grep -v grep
# www-data  2847  0.1  0.3  ./node src/server.js
# www-data  2911  99.2  12.4  /tmp/.X11-unix/cron
```

`/tmp/.X11-unix/cron` is not a cron job you wrote.

## The Upload Directory

```bash
ls -la /app/uploads/ | tail -20
# -rw-r--r-- 1 www-data www-data  2847 May  6 22:14 photo.jpg
# -rw-r--r-- 1 www-data www-data  2847 May  6 22:14 image.png
# -rw-r--r-- 1 www-data www-data  2847 May  6 22:15 document.pdf
# -rw-r--r-- 1 www-data www-data  2847 May  6 22:15 selfie.gif
# -rw-r--r-- 1 www-data www-data 49152 May  6 23:01 shell.php.jpg
```

`shell.php.jpg`. 49 KB. The attacker uploaded a PHP shell disguised as a JPEG.

## The Code

You check the upload handler:

```javascript
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, file.originalname); // ← oh no
  }
});

const upload = multer({ storage });

app.post('/upload', upload.single('image'), (req, res) => {
  res.json({ url: `/uploads/${req.file.originalname}` });
});
```

Three disasters:
1. **`file.originalname` is trusted.** The attacker named their payload `shell.php.jpg`.
2. **No MIME type validation.** Multer accepts anything.
3. **The upload directory is inside the webroot.** `/uploads/shell.php.jpg` is served by Express static middleware. Some misconfigured servers execute `.php` even if the extension is `.php.jpg`.

## The Exploit Chain

1. Attacker uploads `shell.php.jpg` containing PHP reverse shell code.
2. Server saves it to `/app/uploads/shell.php.jpg`.
3. Attacker visits `https://api.example.com/uploads/shell.php.jpg`.
4. A misconfigured Apache/Nginx rule executes the embedded PHP.
5. Server connects back to attacker C2.
6. Attacker has shell access to a server with HIPAA data.

## The Fix (Hidden)

<details>
<summary>Click to reveal</summary>

1. **Never trust `originalname`:**
   ```javascript
   const ext = path.extname(file.originalname).toLowerCase();
   const safeName = `${crypto.randomUUID()}${ext}`;
   ```

2. **Validate MIME types against a whitelist:**
   ```javascript
   const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
   if (!ALLOWED_TYPES.includes(file.mimetype)) {
     fs.unlinkSync(file.path);
     return res.status(400).json({ error: 'Invalid file type' });
   }
   ```

3. **Store uploads outside the webroot:**
   ```javascript
   const storage = multer.diskStorage({
     destination: '/var/lib/uploads/', // NOT served by express.static
   });
   ```
   Serve files through a controller that checks authentication.

4. **Validate magic numbers, not just MIME:**
   ```javascript
   const fs = require('fs');
   const buffer = fs.readFileSync(file.path);
   const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
   ```

5. **Scan with ClamAV** in production before marking files as safe.

6. **Run the app server as a non-privileged user** with no shell access.

</details>

## Post-Incident Review

| Question | Answer |
|----------|--------|
| Why did the upload succeed? | No validation of filename, MIME type, or file content. |
| Why did the shell execute? | Upload directory was inside webroot; server had misconfigured PHP handler. |
| What data was exposed? | All files in `/app/uploads/`, including patient insurance cards. |
| What monitoring gap existed? | No alert for unexpected process names. No file integrity monitoring on `/uploads/`. |
| What architectural flaw? | The application trusted user-supplied filenames and served the upload directory statically. |

## The Real Lesson

> File upload is the most dangerous operation in web development because it invites untrusted binary data into your home. If you let strangers drop files on your server without checking what they are, where they go, and who can run them, you are not running a service. You are running a drive-thru malware distribution center.
