# v1-simple-js

## Goal
Accept a file upload and save it to disk with the simplest possible Express server.

## Code

```js
// src/index.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const app = express();

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
  const dest = `uploads/${req.file.originalname}`;
  fs.renameSync(req.file.path, dest);
  res.json({ path: dest });
});

app.listen(3000, () => console.log('Upload on 3000'));
```

## Decisions
- `multer` default disk storage — zero config.
- `fs.renameSync` to keep original filename — easiest retrieval.

## Risks
- Any file type allowed (executables, HTML with JS).
- Original name can contain `../` — path traversal.
- No size limit — disk fill attack.
- Synchronous `renameSync` blocks the event loop on large files.
