# MD07 AI Content Studio — v2 Add TypeScript

> **Motto**: Types are prompts for the compiler.

## What Changed

Migrated to TypeScript. Added `tsconfig.json`, interfaces for `GenerateRequest`, `GenerateResponse`, and `OpenAIConfig`. Updated imports to use ESM-style syntax (preparing for v6).

## Why

- **OpenAI SDK types**: Autocomplete on `chat.completions.create` prevents parameter typos
- **Refactoring safety**: Renaming `prompt` to `userPrompt` catches all call sites
- **Team velocity**: New engineers understand the API contract without reading runtime code

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express + TS   │─────▶│    OpenAI       │
│  (Writer)   │◀─────│  (typed DTOs)   │◀─────│   API           │
└─────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```typescript
// src/types.ts
export interface GenerateRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}

export interface GenerateResponse {
  response: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// src/server.ts
import express, { Request, Response } from 'express';
import OpenAI from 'openai';
import { GenerateRequest, GenerateResponse } from './types.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
app.use(express.json());

app.post('/generate', async (req: Request, res: Response) => {
  const { prompt, max_tokens = 256, temperature = 0.7 } = req.body as GenerateRequest;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens,
    temperature,
  });

  const response: GenerateResponse = {
    response: completion.choices[0].message.content || '',
    model: completion.model,
    usage: completion.usage,
  };

  res.json(response);
});

app.listen(3000, () => console.log('AI Studio v2 on :3000'));
```

## Decisions

**Option A: Inline types in handler**
- Pros: Fast to write
- Cons: No reuse, diverges across routes

**Option B: Shared `types.ts` file**
- Pros: Single source of truth
- Cons: Slight boilerplate

**Chosen: B** — `GenerateRequest` is reused in the search route.

## Problems We Accepted

- Still no runtime validation — a malformed body passes TypeScript at build time but fails at runtime
- Still no streaming — user waits for the full response
- Still no retry or timeout
- Still no prompt moderation

## Checklist

- [ ] `tsconfig.json` has `strict: true`
- [ ] All route handlers use explicit `Request` / `Response` types
- [ ] No `any` in the OpenAI call chain
- [ ] OpenAI SDK is typed (v4+ provides its own types)

## Next Step

Add runtime validation and prompt moderation.
