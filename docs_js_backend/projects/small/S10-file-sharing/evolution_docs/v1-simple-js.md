# v1 — The Naive File Sharing (Pure JS)

You want to share files with friends. You build an API in 20 minutes.

```js
const express = require('express');
const fs = require('fs');
const app = express();

app.post('/upload', (req, res) => {
  const { filename, data } = req.body;
  fs.writeFileSync(`./uploads/${filename}`, Buffer.from(data, 'base64'));
  res.json({ url: `http://localhost:3000/download/${filename}` });
});

app.get('/download/:filename', (req, res) => {
  const buffer = fs.readFileSync(`./uploads/${req.params.filename}`);
  res.send(buffer);
});

app.listen(3000);
```

Direct links. Simple. Anyone with the URL can download.

## Then the Pain Hits

**The links are permanent.** You uploaded a draft document. The link leaked. Now anyone can access it forever. There's no expiry, no revocation.

**No access control.** A private file has the same URL pattern as a public file. If someone guesses the filename, they get your file.

**No tracking.** You have no idea who downloaded what. Did your client download the contract? You don't know.

## The Realization

You need:
1. **Signed/timed URLs** — links that expire
2. **Access control** — who can access what
3. **Download tracking** — visibility into usage

This is where the evolution starts.
