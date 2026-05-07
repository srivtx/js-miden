# M06 File Uploader: Thinking Exercises

## Exercise 1: The Overwrite

Your upload handler saves files using the original filename:

```javascript
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, file.originalname)
});
```

**Questions:**
1. User A uploads `profile.jpg`. User B uploads `profile.jpg`. What happens to User A's file?
2. An attacker uploads `../../../config/production.yml`. Where does it land? What could they overwrite?
3. Rewrite the filename generator to be safe while preserving the original extension.

---

## Exercise 2: The MIME Lie

A client sends this multipart request:

```
Content-Disposition: form-data; name="image"; filename="photo.jpg"
Content-Type: image/jpeg

[first 4 bytes: 4D 5A 90 00]  ← Windows executable header
```

**Questions:**
1. Will a MIME-type-only validator accept or reject this file?
2. Write a function that validates both MIME type and magic numbers.
3. What is the trade-off between strict validation and user experience (false positives)?

---

## Exercise 3: The Memory Bomb

Your app uses `multer.memoryStorage()`:

```javascript
const upload = multer({ storage: multer.memoryStorage() });
```

**Questions:**
1. A user uploads a 500 MB video. How much RAM does your server use during the upload?
2. If 20 users do this simultaneously, what happens to the Node.js process?
3. Rewrite the storage configuration to stream large files to disk.

---

## Exercise 4: The Static File Leak

You serve uploads with:

```javascript
app.use('/uploads', express.static('uploads'));
```

**Questions:**
1. User A uploads a private medical record. User B guesses the filename pattern. Can they access it?
2. An attacker uploads an HTML file with a `<script>` tag. What happens when someone visits the URL?
3. Design an authenticated file serving endpoint that prevents unauthorized access.

---

## Exercise 5: The Quarantine Queue

You decide to scan every upload with ClamAV before making it available. ClamAV takes 3 seconds per file.

**Questions:**
1. If you scan synchronously, what is the P99 latency for the upload endpoint at 100 req/s?
2. Design an async scan architecture with Redis queues.
3. How do you handle the edge case where a user tries to access their file before scanning completes?

---

## Exercise 6: The Polyglot

A researcher claims they can create a file that is simultaneously:
- A valid JPEG (opens in image viewers)
- A valid HTML file (renders in browsers)
- Contains an embedded JavaScript payload

**Questions:**
1. Is this possible? How?
2. If your system validates magic numbers (`FF D8 FF` for JPEG) and parses with `sharp`, will it catch the payload?
3. What defense would you add to prevent XSS from uploaded images served on your domain?

---

## Discussion Prompts

1. **Is it ever safe to trust `file.originalname`?** Under what circumstances?

2. **Your product manager wants to allow `.pdf` uploads for resumes.** What additional risks does PDF introduce compared to images?

3. **Cloud storage (S3) vs local disk:** What security trade-offs exist when you move uploads from local disk to S3 pre-signed URLs?

4. **A user uploads a photo of their ID card.** It contains PII (name, address, ID number). How does this change your storage, access control, and retention requirements?

5. **Design a file upload system for a anonymous whistleblowing platform.** The requirements: completely anonymous uploads, no size limits, must prevent illegal content. Is this possible?
