# v1 — Simple JS (Naive Image Resizer)

## The Scenario

It's 2am. Your junior built an image resizer. "It uses Sharp, it's fast," they say. You look at the code and feel a chill.

## The PAIN: Buffer-Based Everything

```javascript
// server.js
const express = require('express');
const fs = require('fs');
const sharp = require('sharp');
const app = express();

const uploads = new Map();

app.post('/upload', express.raw({ type: 'image/*', limit: '100mb' }), (req, res) => {
  const id = Math.random().toString(36);
  uploads.set(id, req.body); // <-- 100MB in RAM per upload
  res.json({ id });
});

app.get('/resize/:id', async (req, res) => {
  const buffer = uploads.get(req.params.id);
  if (!buffer) return res.status(404).send('Not found');
  
  const resized = await sharp(buffer)
    .resize(parseInt(req.query.width), parseInt(req.query.height))
    .toBuffer();
    
  res.set('Content-Type', 'image/jpeg');
  res.send(resized);
});

app.listen(3000);
```

### What breaks in production:

1. **Memory exhaustion**: Each upload is a full buffer in RAM. 10 concurrent uploads of 10MB images = 100MB. 100 concurrent = 1GB. Node crashes with "JavaScript heap out of memory."

2. **No input validation**: `width=-500` crashes Sharp. `width=99999` creates a 40GB allocation attempt. `format=exe` gets passed through.

3. **Data loss on restart**: Uploads stored in `Map` vanish on restart. Users get 404s for images they just uploaded.

4. **No format support**: Only JPEG output. Users want PNG transparency or WebP compression? Too bad.

5. **No types**: `req.query.width` is a string. `parseInt("lol")` returns `NaN`. Sharp throws or behaves unexpectedly.

### The moment of realization:

> Junior: "Why does the server crash when I upload 5 images at once?"
> 
> You: "Because you're holding the entire internet in RAM."

## Why we start here

Image processing is deceptively dangerous. It seems like "just call a library," but the combination of large binary data and user-controlled parameters makes it a perfect storm for memory exhaustion and crashes. We start with buffers because it's the obvious way — and the wrong way.

## The fix (next version)

Before we can safely process images, we need to know what we're processing. Types first.
