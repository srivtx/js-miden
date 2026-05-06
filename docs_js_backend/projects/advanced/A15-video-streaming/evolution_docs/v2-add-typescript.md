# v2 — Add TypeScript (Video Streaming)

## The Scenario

It's 2am. Your junior just spent 3 hours debugging why video metadata is missing duration. "JavaScript doesn't care," they mutter. The client sent `duraton` instead of `duration`. The HLS manifest has no `#EXTINF` tag. Players break. You hand them TypeScript.

## The PAIN: Dynamic Typing in Media Systems

From v1, we had this bug:

```javascript
app.post('/videos', (req, res) => {
  const video = {
    id: videos.length + 1,
    title: req.body.title,
    duraton: req.body.duraton, // <-- typo. JavaScript: "undefined? sure."
    path: req.body.path,
  };
});
```

This compiles. Runs. Stores `undefined` as duration. The HLS manifest generator outputs `#EXTINF:undefined,` which crashes Safari. The video is unplayable.

### More typos that bite you:

```javascript
// Wrong property access
video.formt // undefined (real property is 'format')

// Quality as string instead of number
video.quality = '1080' // String where number expected

// Range header parsing
const range = req.headers['range']; // Could be undefined
const parts = range.split('='); // TypeError: Cannot read property 'split' of undefined
```

These runtime errors happen in production. Videos won't play. Users churn. At 2am.

## The Solution: TypeScript

```typescript
// src/types/video.types.ts
export interface Video {
  id: string;
  title: string;
  description?: string;
  duration: number; // in seconds
  format: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamVariant {
  quality: number; // 1080, 720, 480, 360
  bitrate: number;
  path: string;
  codec: string;
}

export interface VideoManifest {
  videoId: string;
  variants: StreamVariant[];
  masterPlaylistUrl: string;
}
```

```typescript
// src/controllers/video.controller.ts
import type { Video, CreateVideoInput } from '../types/video.types.js';

export function createVideo(req: Request, res: Response) {
  const input: CreateVideoInput = req.body;
  // ^ TypeScript knows 'duration' is required, 'duraton' is an error

  const video: Video = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    duration: input.duration,
    format: input.format,
    path: input.path,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  videos.push(video);
  res.status(201).json(video);
}
```

### What TypeScript catches at compile time:

| Bug | JavaScript | TypeScript |
|-----|-----------|------------|
| `req.body.duraton` | Runtime `undefined` | **Compile error**: Property 'duraton' does not exist |
| `video.formt` | Runtime `undefined` | **Compile error**: Property 'formt' does not exist |
| `quality: '1080'` | Runtime string | **Compile error**: Type 'string' not assignable to 'number' |
| Missing `duration` field | Runtime `undefined` | **Compile error**: Property 'duration' is missing |
| `range.split()` without null check | Runtime TypeError | **Compile error**: Object is possibly 'undefined' |

## The New PAIN: Any Types

```typescript
// The lazy way (DON'T DO THIS)
app.post('/videos', (req: Request, res: Response) => {
  const video = req.body as any; // "I don't care about types"
  videos.push(video); // accepts literally anything
});
```

Using `as any` defeats the purpose. It's like accepting any video codec because "the player will figure it out."

## The Realization

> Junior: "TypeScript caught `duraton` before I deployed. That typo would have generated an invalid HLS manifest."
>
> You: "That's not a bug — that's TypeScript doing its job. In video streaming, a typo in metadata can make a video unplayable on half the devices in the world."

## Why this matters for Video Streaming

Our data model has many numeric fields:
- v1: `{ id, title, duration, path }`
- v2: `{ id, title, description, duration, format, path, createdAt, updatedAt }`

Without types, you add `bitrate` to the transcoding pipeline but forget it in the manifest generator. With types, the compiler reminds you: *"Hey, StreamVariant.bitrate exists, but your manifest builder ignores it."*

But TypeScript only catches **developer** bugs. It does nothing when a **user** uploads `{ duration: -1, format: 'exe' }`. For that, we need validation.

## Next: v3 — Add Validation
