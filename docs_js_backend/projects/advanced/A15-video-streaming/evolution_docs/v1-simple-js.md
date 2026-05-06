# v1 — Simple JS (Naive Video Streaming)

## The Scenario

It's 2am. Your junior just deployed their first video server. "It serves MP4 files!" they say. You ask about mobile buffering. They say "it works on WiFi." You ask about 10,000 concurrent users. They change the subject.

## The PAIN: Direct File Serving

```javascript
// server.js
const express = require('express');
const fs = require('fs');
const app = express();

const videos = []; // <-- Video metadata lives here. No files referenced.

app.get('/video/:id', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
 if (!video) return res.status(404).send('Not found');

  // Stream the entire file, always, from byte 0 to the end
  const stream = fs.createReadStream(video.path);
  res.setHeader('Content-Type', 'video/mp4');
  stream.pipe(res);
});

app.listen(3000);
```

### What breaks in production:

1. **No range requests**: A user scrubs to minute 30 of a 2-hour video. The server starts streaming from byte 0. They wait minutes for the seek point. Mobile users give up and leave.

2. **No adaptive bitrate**: A user on 3G gets the same 1080p file as a user on fiber. The 3G user buffers forever. The fiber user wastes bandwidth.

3. **No transcoding**: You upload a 4K ProRes file. The server tries to stream a 2GB file to a phone. It crashes. You have no 720p, 480p, or 360p variants.

4. **No CDN**: Every request hits your origin server. 10,000 concurrent streams = 10,000 open file descriptors = your server dies.

5. **No upload resumption**: A user uploads a 10GB file. Their connection drops at 9.9GB. They start over from byte 0. They hate you.

### The moment of realization:

> Junior: "Why is the server unresponsive when 100 people watch the same video?"
>
> You: "Because you're reading a 2GB file from disk 100 times simultaneously. Because you have no CDN. Because `fs.createReadStream` is not a video platform."

## Why we start here

This is how every developer builds their first video server. It's simple. It serves a file. And it's completely unsuitable for any real-world streaming scenario. We keep this version to remember the pain — so we understand why range requests, adaptive bitrate, and CDN integration exist.

## The fix (next version)

We need types to prevent `req.params.id` mismatches. But more importantly, we need **HTTP range requests** — so users can seek without downloading the entire file.
