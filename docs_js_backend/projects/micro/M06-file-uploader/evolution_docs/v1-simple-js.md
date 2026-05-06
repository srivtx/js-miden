# v1-simple-js.md — "I just want it to work"

## The 10-Minute Version

Users want to upload profile pictures. You set up the simplest possible endpoint:

```js
// server.js
const express = require('express');
const multer = require('multer');
const app = express();

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('image'), (req, res) => {
  res.json({
    message: 'File uploaded',
    filename: req.file.filename,
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

**"This works. Files go in the uploads folder. Ship it."**

## The 3am Page

Your disk is full. Someone uploaded a 2GB file named `video.mp4` as their "profile picture." Then they did it again. And again. Your server stopped responding because the disk hit 100%.

You SSH in, delete files, and restart. But what about the 47 files named `.exe` that were uploaded last week? Your "image" uploader accepted anything. One of them might have been executed by a misconfigured web server.

## The Bug You Can't See

You add a quick extension check:

```js
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.jpg')) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg allowed'));
    }
  },
});
```

A user renames `malware.exe` to `malware.jpg` and uploads it. Your check passes. The file is still an executable. Extension checks validate the *name*, not the *content*.

Also, you're buffering the entire file into a temporary directory before checking anything. For a 2GB upload, you use 2GB of disk before rejecting it. And if two people upload at the same time, the temp files might collide or exhaust disk space.

## What We Have

- **No validation** — any file type, any size
- **Extension checks** — trivially bypassed by renaming
- **No content validation** — magic numbers never checked
- **No streaming** — files buffered entirely to disk before any logic runs

## What We Need

Real validation: size limits, MIME type checking, magic number verification. And streaming so we don't commit disk space to garbage.
