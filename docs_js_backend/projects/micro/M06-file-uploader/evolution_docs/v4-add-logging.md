# v4-add-logging.md — "Something broke but I can't see what"

## The Bug

Users report uploads failing with "Upload failed." You check the server. It's running. You have no logs.

You add `console.log`:

```ts
app.post('/upload', upload.single('image'), (req, res) => {
  console.log('Upload request');
  if (!req.file) {
    console.log('No file');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log('File:', req.file.originalname, req.file.size);
  res.json({ message: 'File uploaded' });
});
```

The output:

```
Upload request
No file
Upload request
File: photo.jpg 2048576
Upload request
File: exploit.exe 1024
```

Wait, `exploit.exe`? Your file filter was supposed to block that. But the filter uses MIME type, and the client lied. You have no structured record of which files were rejected or why.

Also, `No file` happens 50 times in a row. Is it the same user? Different users? A bug in the frontend? A bot? You can't tell.

## The 3am Page, Redux

A user emails: "I uploaded a 4MB file and got 413." You check the config. The limit is 5MB. You have no log of the actual request. Maybe the file was 4.9MB. Maybe it was 6MB and the client rounded. Maybe the limit was misconfigured.

Without structured logs, debugging uploads is guessing.

## Adding Pino Structured Logging

```bash
npm install pino
```

```ts
// src/server.ts
import { createLogger } from 'pino';

const app = express();
const logger = createLogger({
  name: 'file-uploader',
  level: process.env.LOG_LEVEL || 'info',
});

app.use((req, res, next) => {
  const requestId = randomUUID();
  (req as any).id = requestId;

  const startTime = Date.now();
  res.on('finish', () => {
    logger.info({
      requestId,
      method: req.method,
      path: req.url,
      statusCode: res.statusCode,
      durationMs: Date.now() - startTime,
    }, 'request completed');
  });
  next();
});
```

```ts
// src/routes/upload.ts
router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    logger.warn({ requestId: (req as any).id }, 'upload rejected: no file');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  logger.info({
    requestId: (req as any).id,
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  }, 'file uploaded');

  res.json({ message: 'File uploaded successfully' });
});
```

Now:

```json
{
  "level": 30,
  "time": 1715123456789,
  "name": "file-uploader",
  "requestId": "abc-123",
  "method": "POST",
  "path": "/upload",
  "statusCode": 200,
  "durationMs": 45,
  "msg": "request completed"
}
```

And:

```json
{
  "level": 30,
  "time": 1715123456790,
  "name": "file-uploader",
  "requestId": "abc-123",
  "filename": "photo.jpg",
  "size": 2048576,
  "mimetype": "image/jpeg",
  "msg": "file uploaded"
}
```

## Why Pino?

- **JSON** is parseable by log aggregators
- **Request IDs** trace a single upload through the system
- **File metadata** is logged for audit and debugging
- **Error serialization** captures multer and disk errors

## Querying in Production

```bash
# Uploads by file size bucket
docker logs api | jq -s '
  map(select(.msg == "file uploaded"))
  | map(.size)
  | { small: map(select(. < 1024*1024)) | length,
      medium: map(select(. >= 1024*1024 and . < 3*1024*1024)) | length,
      large: map(select(. >= 3*1024*1024)) | length }
'

# Rejected uploads (no file)
docker logs api | jq 'select(.msg == "upload rejected: no file")'
```

## What Changed

- Added Pino for structured logging
- Every request gets a `requestId`
- Uploads log filename, size, and MIME type
- Rejections are logged at `warn` level
- Response times expose slow uploads

## What We Still Need

Logging shows us upload patterns after they happen. But when we add streaming or change the storage backend, we might break small file uploads or lose files. We need to catch that before deploy.

For that, we need tests.
