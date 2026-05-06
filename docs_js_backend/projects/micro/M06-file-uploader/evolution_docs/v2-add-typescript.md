# v2-add-typescript.md — "I passed the wrong field name"

## The Bug

You're handling file uploads. You need to access the uploaded file's properties:

```js
app.post('/upload', upload.single('image'), (req, res) => {
  res.json({
    name: req.file.orignalname, // <-- typo
    size: req.file.size,
  });
});
```

`orignalname`. `undefined`.

The client sees `{ name: undefined, size: 1024 }`. They expected the original filename. Their database stores `null`. The UI shows a blank filename. You get a bug report: "uploads work but filenames are missing."

You check the multer docs. The property is `originalname`. You fix it. But the bug was in production for two weeks.

## The 3am Page, Redux

You add a new field from the file object:

```js
app.post('/upload', upload.single('image'), (req, res) => {
  res.json({
    name: req.file.originalname,
    mime: req.file.mimtype, // <-- typo
    size: req.file.size,
  });
});
```

`mimtype`. The downstream service expects `mimeType`. It crashes when trying to process `undefined`. Your "simple" upload service is now causing cascading failures.

## Adding TypeScript

```bash
npm install -D typescript @types/node @types/express @types/multer tsx
```

```ts
// src/routes/upload.ts
import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload.js';

const router = Router();

router.post('/', upload.single('image'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({
    name: req.file.orignalname, // <-- RED SQUIGGLE
    mime: req.file.mimtype,     // <-- RED SQUIGGLE
    size: req.file.size,
  });
});
```

> Property 'orignalname' does not exist on type 'Express.Multer.File'. Did you mean 'originalname'?

> Property 'mimtype' does not exist on type 'Express.Multer.File'. Did you mean 'mimetype'?

Both caught before the commit.

## What Changed

- Added `@types/multer` for typed `req.file`
- `tsconfig.json` with `"strict": true`
- Autocomplete shows all available properties
- Typos in property names are compiler errors

## What We Still Need

TypeScript knows `req.file` exists and what properties it has. But it can't stop someone from uploading a `.exe` renamed to `.jpg`. The `mimetype` field is set by the client — it can lie.

For file uploads, we need runtime validation of content, not just names.
