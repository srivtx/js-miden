# v3 — Add Validation (Video Streaming)

## The Scenario

It's 2am. Your junior added TypeScript. "No more typos!" they celebrate. Then a client uploads a file with `{ duration: -1, format: 'exe', title: '' }` and the API stores it. TypeScript didn't help — the runtime data was wrong.

## The PAIN: TypeScript Doesn't Validate Runtime Data

From v2:

```typescript
app.post('/videos', (req: Request, res: Response) => {
  const input: CreateVideoInput = req.body; // Type assertion = TRUST
  // Client sends: { duration: -1, format: 'exe', title: '' }
  // TypeScript believes it's valid. The video is garbage.
});
```

TypeScript is a compile-time guard. At runtime, `req.body` is whatever the client sent. A type assertion (`as CreateVideoInput`) is a lie we tell the compiler.

### Real bugs from production:

```json
// Client sends:
{ "duration": -1, "format": "exe", "title": "" }
// Negative duration. Executable file. Empty title. The HLS manifest breaks.

{ "title": "a".repeat(10000) }
// Title too long. Database column overflow. UI breaks.

{ "range": "bytes=0-999999999999" }
// Malicious range request. Memory exhaustion. Denial of service.
```

## The Solution: Zod Schema Validation

```typescript
// src/routes/video.routes.ts
import { z } from 'zod';

const createVideoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  duration: z.number().int().positive().max(86400), // Max 24 hours
  format: z.enum(['mp4', 'mov', 'mkv', 'avi']),
});

const rangeSchema = z.object({
  range: z.string().regex(/^bytes=\d+-\d*$/, 'Invalid range format'),
});
```

```typescript
app.post('/videos', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createVideoSchema.parse(req.body);
    // ^ Zod validates AND transforms. parsed is guaranteed to match the schema.
    const video = createVideo(parsed);
    res.status(201).json(video);
  } catch (err) {
    next(err); // Goes to error handler
  }
});
```

### What Zod catches:

| Input | TypeScript alone | Zod validation |
|-------|---------------|----------------|
| `{ duration: -1 }` | ❌ Accepts via assertion | **Error**: Number must be greater than 0 |
| `{ format: 'exe' }` | ❌ Accepts any string | **Error**: Invalid enum value |
| `{ title: '' }` | ❌ Accepts empty | **Error**: String must contain at least 1 character(s) |
| `{ title: 'a'.repeat(201) }` | ❌ Accepts | **Error**: String must contain at most 200 character(s) |
| `{ range: 'bytes=0-999999999999' }` | ❌ Accepts | **Error**: Range too large (caught in handler logic) |

## The PAIN of Naive Validation

```typescript
// The "I'll write it myself" approach (DON'T)
function validateVideo(body: any) {
  if (!body.title) throw new Error('Title required');
  if (!body.duration) throw new Error('Duration required');
  // ... 50 more lines for every field
  // Forgot to check format whitelist? Malware upload exploit.
  // Forgot to limit range size? DoS vulnerability.
}
```

Hand-rolled validation is:
- **Verbose**: 50 lines vs 8 lines of Zod
- **Inconsistent**: One endpoint checks formats, another doesn't
- **Untyped**: The "validated" output is still `any`

## The Zod Advantage: Types from Schemas

```typescript
// Derive TypeScript types FROM the schema (single source of truth)
type CreateVideoInput = z.infer<typeof createVideoSchema>;
// Equivalent to: { title: string; description?: string; duration: number; format: 'mp4' | 'mov' | 'mkv' | 'avi' }
```

Now your TypeScript types and runtime validators are **the same thing**. Change the schema? Both update automatically.

## Validation Evolution in Video Streaming

| Version | Validation | What breaks |
|---------|-----------|-------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Type assertions | Runtime garbage enters pipeline |
| v3 (Zod) | Schema parsing | Nothing (caught at boundary) |

## The Realization

> Junior: "Zod rejected an upload with `format: 'exe'`. The error message even said 'Invalid enum value'."
>
> You: "That's the difference. TypeScript tells *you* about typos. Zod tells *users* about their mistakes. Both are necessary. In video streaming, one invalid upload can break the transcoding pipeline or serve malware."

## The Next PAIN

Validation catches user bugs, but what about **your** bugs? What happens when the transcoding service throws because of a corrupt file? What happens when an unhandled promise rejection crashes the process during a live stream?

## Next: v4 — Add Logging
