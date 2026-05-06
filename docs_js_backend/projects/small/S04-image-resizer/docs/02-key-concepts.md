# S04 Image Resizer — Key Concepts

## 1. Image Processing Pipelines

Sharp constructs a pipeline of operations that are executed lazily when `.toBuffer()` or `.toFile()` is called.

```ts
sharp(input)
  .resize(200, 200, { fit: 'inside' })
  .toFormat('webp', { quality: 80 })
  .toBuffer();
```

**Why pipelines matter**: libvips streams operations so that intermediate images are never fully materialized in memory. A 10,000×10,000 pixel image resized to 100×100 does not allocate a 10K×10K buffer.

**Pipeline stages** (in order):
1. Decode (JPEG/PNG/WebP → libvips image)
2. Resize/rotate/crop
3. Color space conversion
4. Encode (libvips image → output format)

## 2. Streams with Sharp

Sharp supports both buffers and streams:

```ts
// Buffer (loads entire file into memory)
const buffer = await readFile(path);
const out = await sharp(buffer).resize(200).toBuffer();

// Stream (processes chunks as they arrive)
await pipeline(
  createReadStream(path),
  sharp().resize(200),
  createWriteStream(outPath)
);
```

**Why streams exist**: They keep memory usage constant regardless of input file size. A 50 MB image streamed through Sharp uses ~10 MB of RAM; buffered it uses 50 MB + overhead.

**Sharp stream limitation**: You cannot query metadata (width/height) before the stream completes unless you use `.metadata()` on a separate read.

## 3. Format Conversion

| Format | Best For | Sharp Support | Notes |
|--------|----------|---------------|-------|
| JPEG | Photos | Excellent | Lossy, adjustable quality |
| PNG | Graphics, transparency | Excellent | Lossless, larger files |
| WebP | Modern web | Excellent | 25-35% smaller than JPEG |
| AVIF | Next-gen | Good (libheif) | 50% smaller than JPEG, slower encode |
| GIF | Animations | Limited | Use `sharp` for static frames only |

**Why WebP is the default modern choice**: Google, Apple, and Mozilla all support it. It offers transparency like PNG and compression like JPEG.

**AVIF trade-off**: Encoding a 4K image to AVIF can take 2-5 seconds. Use it for pre-generated assets, not on-the-fly resizing.

## 4. Memory Management

Node.js has a default heap limit of ~1.4 GB (64-bit). Image processing allocates **outside** the V8 heap in native memory via libvips.

**Sharp concurrency controls**:
```ts
sharp.concurrency(2);        // libvips worker threads
sharp.cache({ items: 100 }); // decoded image cache
```

If you process many images simultaneously, native memory can exceed container limits and trigger an OOM kill.

**Why this matters**: Kubernetes or Docker memory limits apply to the entire process, including native allocations. A container with 512 MB limit will be killed if 10 concurrent 20 MB images are buffered.

## 5. MIME Type Validation

Current code trusts `req.file.mimetype`, which is set by the browser based on the file extension:

```ts
uploads.set(id, { filename: req.file.filename, mimetype: req.file.mimetype });
```

**Why this is dangerous**: A user can rename `virus.exe` to `image.jpg` and the browser will send `image/jpeg`.

**Proper validation** checks file **magic bytes** (file signature):

| Format | Magic Bytes (hex) |
|--------|-------------------|
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47` |
| WebP | `52 49 46 46` |
| GIF | `47 49 46 38` |

Use `file-type` npm package or read the first few bytes manually:
```ts
const buf = await readFile(path, { length: 8 });
if (!buf.slice(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) {
  throw new Error('Invalid JPEG');
}
```

## 6. Resize Fit Modes

```ts
sharp(input).resize(200, 200, { fit: 'inside' });
```

| Fit | Behavior | Use Case |
|-----|----------|----------|
| `cover` | Crop to fill both dimensions | Thumbnails (center crop) |
| `contain` | Letterbox to fit both | Preserving aspect ratio with padding |
| `inside` | Scale down to fit inside | Max-width constraints |
| `outside` | Scale up to cover, then crop | Background images |
| `fill` | Distort to exact dimensions | Rarely used |

`inside` is safest for user-uploaded content because it never crops away parts of the image.
