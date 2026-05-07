# M06 File Uploader: Three Wrongs

## Wrong #1: Trusting `originalname`

### The Code
```javascript
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
```

### Why It Feels Right
- Users expect their filename to be preserved.
- It is the default behavior in many tutorials.
- "The user uploaded `vacation.jpg`. Why would I rename it?"

### Why It Is Wrong
| Problem | Consequence |
|---------|-------------|
| Path traversal | `filename="../../../app/server.js"` overwrites your code |
| Overwrite attacks | Two users upload `avatar.jpg` — the second overwrites the first |
| Special characters | `file;rm -rf /;.jpg` can break shell scripts that process files |
| Information leakage | Original filename may contain sensitive metadata (`Tax_Return_2025_SSN_123-45-6789.pdf`) |

### The Realization
> "I let a stranger name the file on my server. That is like letting a burglar choose which lock to pick."

---

## Wrong #2: Using `memoryStorage` for Persisted Files

### The Code
```javascript
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('image'), (req, res) => {
  const url = `/uploads/${req.file.originalname}`;
  res.json({ url });
});
```

### Why It Feels Right
- No disk I/O. Faster responses.
- Easy to access `req.file.buffer` for immediate processing.
- "I will write to disk later in a background job."

### Why It Is Wrong
| Problem | Consequence |
|---------|-------------|
| Files are not persisted | The returned URL points to a file that does not exist |
| Unbounded memory growth | 100 concurrent 5MB uploads = 500MB RAM. 1000 uploads = 5GB. Node.js crashes. |
| No streaming | The entire file must fit in memory before you can respond |

### The Realization
> "My app crashed in production because 50 users uploaded photos at the same time. The files were never saved. The URLs were lies."

---

## Wrong #3: Serving Uploads with `express.static`

### The Code
```javascript
app.use('/uploads', express.static('uploads'));
app.post('/upload', upload.single('image'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});
```

### Why It Feels Right
- Simple. One line of code.
- Static files should be served statically.
- "The files are just images. What could go wrong?"

### Why It Is Wrong
| Problem | Consequence |
|---------|-------------|
| No access control | Anyone with the URL can download any file, including other users' uploads |
| XSS via HTML upload | Attacker uploads `.html` with `<script>`, it executes on your domain |
| Content-Type sniffing | Browsers may ignore `Content-Type` and execute files based on content |
| Directory listing | Misconfigured static middleware may list all files |

### The Realization
> "I built a public file host without knowing it. Attackers used it to distribute malware. My domain was blacklisted by Google Safe Browsing."

---

## The Pattern

All three wrongs share the same root cause: **trusting user input at the boundary of the system.**

| Wrong | Trusted input | Violated principle |
|-------|-------------|-------------------|
| `originalname` | Filename | Never trust client-supplied identifiers |
| `memoryStorage` | File size / concurrency | Bound resource usage; persist what you promise to serve |
| `express.static` | File content / access patterns | Serve user-generated content through a gatekeeper |

> The wrong solutions feel right because they optimize for developer convenience. Security is rarely convenient. It is the tax you pay for not being tomorrow's headline.
