# S04 Image Resizer API

## Concepts
- File upload handling (multer)
- Image processing (sharp/libvips)
- Streams vs Buffers
- Format conversion & caching

## Phase 1
- `POST /upload` accepts an image, saves original to disk.
- `GET /resize/:id?width=300&height=200&format=webp` returns resized image.
- Supports jpg, png, webp.

## Phase 2-3 Thinking Framework
1. **Streams vs Buffers**: Phase 1 reads the whole file into memory (`readFile` → `Buffer`). For large images this causes OOM. Fix: use `createReadStream` and pipe through `sharp()` to `Response`.
2. **Maintaining Aspect Ratio**: `sharp.resize({ fit: 'inside' })` preserves aspect ratio. If only width or height is provided, omit the other.
3. **Format Conversion**: `sharp.toFormat('webp')` handles conversion. Validate requested format against allow-list.
4. **Caching**: Cache resized versions on disk keyed by `(id, width, height, format)` to avoid re-processing. Use a cache directory and serve directly if present.
5. **Security**: Validate file type via magic numbers, not just extension. Reject non-image uploads.
6. **Dimension Validation**: Reject non-positive, NaN, or absurdly large values before calling sharp.

## Bug
- **Buffer processing**: `readFile(filePath)` loads the entire image into memory before resizing. On large images this exhausts memory.
- **Missing validation**: `width`/`height` are not validated (negative values crash sharp).

## Run
```bash
npm install
npm run dev
```

## Test
```bash
npm test
```
