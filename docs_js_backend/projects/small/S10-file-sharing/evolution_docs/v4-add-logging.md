# v4 — Adding Logging

A user emails you: "I shared a link to my contract but I don't know if the client downloaded it."

You check your API. You have no logs. You have no idea. You can't even tell them if the link was accessed.

## The Fix: Structured Logging + Tracking

You log every upload and download with context.

```ts
import pino from 'pino';
const logger = pino();

app.post('/upload', (req, res) => {
  logger.info({ token, filename: originalName, size: buffer.length }, 'File uploaded');
});

app.get('/download/:token', (req, res) => {
  logger.info({ token, ip: req.ip }, 'File downloaded');
  // Increment counter
  db.prepare('UPDATE files SET download_count = download_count + 1 WHERE token = ?').run(req.params.token);
});
```

Now you can:
- See how many times a file was downloaded
- Track which IPs accessed it
- Detect suspicious activity (100 downloads from different IPs in 1 minute)

## Why This Matters

Without logs, file sharing is a black box. You send a link and hope. With logs and counters, you have visibility.

**Next:** Let's write tests so path traversal doesn't come back.
