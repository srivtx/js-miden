# S04 Image Resizer — Overview

## Project Goal
Build an image upload and on-demand resize endpoint that converts formats, scales dimensions, and returns optimized images.

## Architecture
```
Client → POST /upload (multipart/form-data)
         └── multer → disk storage → Map metadata

Client → GET /resize/:id?width=200&height=200&format=webp
         └── readFile → sharp pipeline → response buffer
```

## Tech Stack
- **Runtime**: Node.js + Express + TypeScript
- **Upload**: `multer` (disk storage)
- **Processing**: `sharp` (libvips bindings)
- **Storage**: Local filesystem (`./uploads`)

## What This Project Demonstrates
1. Image processing pipelines with Sharp
2. On-the-fly format conversion
3. Stream vs buffer trade-offs
4. Memory management risks
5. MIME type validation gaps

## Quick Start
```bash
npm install
npm run dev
```

## File Map
| File | Responsibility |
|------|----------------|
| `src/routes.ts` | Upload and resize handlers |
| `src/index.ts` | Server bootstrap |
| `tests/resize.test.ts` | Integration tests |

## Production Checklist
- [ ] Add input validation for width/height
- [ ] Stream from disk instead of buffering entire files
- [ ] Validate MIME type against file content (magic bytes)
- [ ] Limit output dimensions to prevent DoS
- [ ] Store originals in S3, not local disk
