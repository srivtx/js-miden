# M06 File Uploader: Impossible Constraints

## Constraint 1: "I Must Accept Large Files, But Never Run Out of Memory"

### Why It Sounds Impossible
Large files require large buffers. Buffers require memory. Memory is finite.

### The Solution: Streaming to Disk
Use `multer.diskStorage` instead of `memoryStorage`. The file is streamed directly from the TCP socket to the filesystem, using a bounded memory buffer (typically 64 KB).

```javascript
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
  }
});
```

Memory usage is independent of file size. A 10 GB upload uses the same RAM as a 10 KB upload.

> The constraint is not "accept large files in memory." It is "accept large files without buffering them in memory." Streaming makes the impossible routine.

---

## Constraint 2: "I Must Validate File Type, But MIME Types Are Spoofable"

### Why It Sounds Impossible
If the client can lie about the file type, how can you ever trust what you receive?

### The Solution: Defense in Depth
Layer 1: **Extension whitelist**
```javascript
const ext = path.extname(file.originalname).toLowerCase();
if (!['.jpg', '.png', '.gif'].includes(ext)) reject();
```

Layer 2: **MIME type whitelist**
```javascript
if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) reject();
```

Layer 3: **Magic number validation**
```javascript
const buffer = fs.readFileSync(filePath);
const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8;
```

Layer 4: **Image parsing** (strongest)
```javascript
import sharp from 'sharp';
try {
  await sharp(filePath).metadata();
} catch (err) {
  // Not a valid image
  reject();
}
```

An attacker must spoof all four layers simultaneously. That is computationally infeasible for most threat models.

> You do not need perfect trust in any single signal. You need imperfect signals that do not fail in the same way.

---

## Constraint 3: "Users Must Access Their Files, But No One Else's"

### Why It Sounds Impossible
If you serve files via a static URL, anyone with the URL can access them. URLs leak. Browser history leaks. Referrer headers leak.

### The Solution: Indirect Reference + Authentication
1. **Store files with random names:** `a1b2c3d4.jpg`
2. **Map random names to users in your database:**
   ```sql
   CREATE TABLE uploads (
     id UUID PRIMARY KEY,
     user_id UUID NOT NULL,
     filename TEXT NOT NULL,
     storage_path TEXT NOT NULL
   );
   ```
3. **Serve through an authenticated controller:**
   ```javascript
   app.get('/files/:id', authenticate, async (req, res) => {
     const upload = await db.query(
       'SELECT * FROM uploads WHERE id = $1 AND user_id = $2',
       [req.params.id, req.user.id]
     );
     if (!upload) return res.status(404).send('Not found');
     res.sendFile(upload.storage_path);
   });
   ```

4. **Add signed URLs for temporary access:**
   ```javascript
   const signedUrl = await s3.getSignedUrlPromise('getObject', {
     Bucket: 'my-bucket',
     Key: upload.storage_path,
     Expires: 300, // 5 minutes
   });
   ```

> Security through obscurity (random filenames) is not enough. But security through obscurity PLUS authentication PLUS expiration is very hard to defeat.

---

## Constraint 4: "I Must Scan for Viruses, But Not Slow Down the Upload"

### Why It Sounds Impossible
Virus scanning is slow. A full ClamAV scan of a 5MB file takes 2-5 seconds. Users will not wait.

### The Solution: Async Scanning + Quarantine
1. **Upload succeeds immediately.** File goes into a `quarantine/` directory.
2. **Return a "pending" URL.**
3. **Background worker scans the file.**
4. **On clean:** Move to `clean/` and notify the user.
5. **On infected:** Delete and alert.

```javascript
app.post('/upload', upload.single('image'), async (req, res) => {
  const quarantinePath = `/var/quarantine/${req.file.filename}`;
  await fs.promises.rename(req.file.path, quarantinePath);

  // Queue for scanning
  await scanQueue.add({ path: quarantinePath, filename: req.file.filename });

  res.status(202).json({
    status: 'pending',
    checkUrl: `/status/${req.file.filename}`
  });
});
```

> Do not block the user for security. Queue the security work and move on.

---

## Constraint 5: "I Must Store Files Forever, But Disk Space Is Finite"

### Why It Sounds Impossible
Users upload infinitely. Disks do not grow infinitely.

### The Solution: Lifecycle Policies
| Age | Action |
|-----|--------|
| 0-30 days | Active storage, full availability |
| 30-90 days | Move to cold storage (S3 Glacier, tape) |
| 90+ days | Delete or archive to cheapest tier |

Automate with cron or cloud lifecycle rules:
```bash
# Delete uploads older than 90 days
find /uploads -type f -mtime +90 -delete
```

Inform users of retention policies. Give them export tools.

> Infinite storage is a business problem, not a technical one. Solve it with policy, not bigger disks.

---

## The Meta-Pattern

Every "impossible" constraint in file upload is solved by the same realization:

> **Do not do the work synchronously if you can do it asynchronously. Do not trust one signal if you can verify with three. Do not expose directly what you can expose indirectly.**

The impossible constraints are not engineering dead ends. They are design prompts that force you to separate concerns, layer defenses, and think like an adversary.
