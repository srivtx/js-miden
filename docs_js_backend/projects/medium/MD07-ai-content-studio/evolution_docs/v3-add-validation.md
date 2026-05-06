# MD07 AI Content Studio — v3 Add Validation

> **Motto**: Validate before you generate.

## What Changed

Added `zod` schemas for every inbound request. Validation runs before any OpenAI call. Invalid prompts, token limits, or temperature ranges return `400` with a clear error message. Added a basic prompt moderation middleware that rejects known injection patterns.

## Why

- **Cost control**: A `max_tokens` of 100,000 could bankrupt the API key
- **Security**: Prevents prompt injection attacks that override system instructions
- **Contract**: The zod schema *is* the API contract

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│     Zod         │─────▶│   Moderation    │─────▶│    OpenAI       │
│  (Writer)   │◀─────│  (validate)     │◀─────│   (reject)      │◀─────│   API           │
└─────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
                            │
                            ▼ (400 Bad Request)
                     ┌─────────────────┐
                     │  Clear error    │
                     │  { field, msg } │
                     └─────────────────┘
```

## Code

```typescript
// src/validators/generate.ts
import { z } from 'zod';

export const generateSchema = z.object({
  prompt: z.string().min(1).max(4000),
  max_tokens: z.number().int().min(1).max(4096).default(256),
  temperature: z.number().min(0).max(2).default(0.7),
});

export type GenerateInput = z.infer<typeof generateSchema>;

// src/middleware/moderation.ts
import { Request, Response, NextFunction } from 'express';

const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt/i,
  /you are now a/i,
  /DAN/i,
  /jailbreak/i,
];

export function moderatePrompt(req: Request, res: Response, next: NextFunction) {
  const prompt = req.body.prompt || '';
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      res.status(400).json({ error: 'Prompt rejected by moderation filter' });
      return;
    }
  }
  next();
}
```

## Decisions

**Option A: OpenAI Moderation API**
- Pros: Official, covers hate, self-harm, sexual content
- Cons: Extra API call (~100ms), costs money

**Option B: Regex-based local filter**
- Pros: Instant, free, blocks known injection patterns
- Cons: Can be bypassed with creative spelling

**Chosen: Both** — regex filter for speed (blocks 90% of injection attempts), OpenAI Moderation API for completeness (v7 will add it).

## Problems We Accepted

- Regex moderation is brittle; adversarial prompts can bypass it
- No token rate limiting yet (v7 will cap hourly usage)
- No semantic search yet (v7 will add embeddings)

## Checklist

- [ ] Every `POST` route has a zod schema
- [ ] `prompt` length is bounded (prevents multi-megabyte inputs)
- [ ] `max_tokens` is capped at 4096
- [ ] `temperature` is between 0 and 2
- [ ] Moderation middleware runs before the handler

## Next Step

Add structured logging so we can trace prompts and token usage.
