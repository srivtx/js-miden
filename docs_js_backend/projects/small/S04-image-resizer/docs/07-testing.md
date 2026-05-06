# S04 Image Resizer — Testing

## Test Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | Sharp pipeline in isolation |
| Integration | Supertest + multer | Upload + resize end-to-end |
| Load | `autocannon` | Memory usage under concurrency |
| Fuzz | Custom scripts | Invalid dimensions, corrupt files |

## Key Test Cases

### 1. Valid Upload & Resize
```ts
const res = await request(app)
  .post('/upload')
  .attach('image', 'fixtures/sample.jpg');
expect(res.status).toBe(200);
const { id } = res.body;

const resize = await request(app).get(`/resize/${id}?width=200&format=webp`);
expect(resize.status).toBe(200);
expect(resize.headers['content-type']).toBe('image/webp');
```

### 2. Missing File
```ts
const res = await request(app).get('/resize/nonexistent');
expect(res.status).toBe(404);
```

### 3. Invalid Dimensions (Bug Demonstration)
```ts
const upload = await request(app)
  .post('/upload')
  .attach('image', 'fixtures/sample.jpg');
const id = upload.body.id;

const res = await request(app).get(`/resize/${id}?width=-1`);
// Current code: likely 500 or crash
// Fixed code: 400
```

### 4. Memory Stress Test
```ts
const large = Buffer.alloc(20 * 1024 * 1024); // 20 MB
// Upload and then request 50 concurrent resizes
```

Monitor RSS with `process.memoryUsage()`. With buffers, expect >500 MB; with file paths, expect <100 MB.

### 5. Format Conversion
```ts
for (const fmt of ['jpeg', 'png', 'webp']) {
  const res = await request(app).get(`/resize/${id}?format=${fmt}`);
  expect(res.headers['content-type']).toBe(`image/${fmt === 'jpg' ? 'jpeg' : fmt}`);
}
```

### 6. Corrupt File Handling
```ts
const corrupt = Buffer.from('not an image');
const upload = await request(app)
  .post('/upload')
  .attach('image', corrupt, 'fake.jpg');
// Current multer config accepts it; resize should reject
```

## Load Testing

```bash
npx autocannon -c 20 -d 10 \
  "http://localhost:3000/resize/${ID}?width=800&height=600"
```

Watch `htop` or `docker stats`. If RSS grows linearly with concurrency, you are buffering instead of streaming.

## Visual Regression

For production, use `pixelmatch` or `looks-same` to compare resized output against a golden reference:

```ts
import pixelmatch from 'pixelmatch';
const diff = pixelmatch(img1, img2, null, width, height, { threshold: 0.1 });
expect(diff).toBe(0);
```

This catches Sharp version upgrades that subtly change output encoding.
