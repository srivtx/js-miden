# v1 — The Naive Video Uploader (Pure JS)

You want to let users upload videos. You build a quick Express API.

```js
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use(express.json());

app.post('/upload', (req, res) => {
  const { filename, data } = req.body;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
  res.json({ url: `/videos/${filename}` });
});

app.get('/videos/:filename', (req, res) => {
  const filepath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.resolve(filepath));
});

app.listen(4000, () => console.log('Video server on 4000'));
```

Upload a base64 video. Serve it back. Done.

## Then the Pain Hits

**No format validation.** A user uploads `video.exe`. Your server stores it. Another user downloads and runs it. You just became a malware distribution platform.

**No size limits.** A user uploads a 10GB file. Your server's disk fills up. Other uploads fail. The process crashes.

**Raw files only.** Users on mobile get the same 4K 50Mbps file. It buffers forever. They abandon the stream.

**No live streaming.** Users ask for live broadcasts. Your upload-then-serve model can't do it. OBS can't connect to `/upload`.

**No chat.** Viewers want to talk to the streamer. Your video server has no real-time messaging.

## The Realization

A video uploader is not a streaming platform. You need:
1. **Protocol support** — RTMP for ingest, HLS for delivery
2. **Transcoding** — multiple qualities for adaptive bitrate
3. **Live streaming** — real-time, not upload-then-serve
4. **Chat** — WebSocket messaging alongside video
5. **Analytics** — viewer counts, engagement metrics

This is where the evolution starts.
