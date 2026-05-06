# MD07 AI Content Studio — v7 Production Setup

> **Motto**: Stream fast, retry smart, moderate everything.

## What Changed

This is the full production-grade AI content studio:
- **Streaming** — Server-Sent Events (SSE) for real-time token delivery
- **Retry logic** — exponential backoff for transient OpenAI errors (429, 500, 503)
- **Timeout** — `AbortController` with 30s ceiling on every stream
- **Embeddings** — vector storage in PostgreSQL with `pgvector` for semantic search
- **Moderation** — OpenAI Moderation API + regex filters for prompt injection
- **Token rate limiting** — hourly cap per tenant to control costs

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express + SSE  │─────▶│    OpenAI       │
│  (Writer)   │◀─────│  (stream)       │◀─────│   (streaming)   │
└─────────────┘      └────────┬────────┘      └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  PostgreSQL  │
                       │  + pgvector  │
                       │  (contents)  │
                       └──────────────┘
```

## Code

### Streaming

```typescript
// src/services/llm.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-test' });
const MAX_STREAM_TIMEOUT_MS = 30000;

export async function* streamCompletion(
  prompt: string,
  maxTokens: number,
  temperature: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAX_STREAM_TIMEOUT_MS);

  try {
    const stream = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
        stream: true,
      },
      { signal: controller.signal }
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}
```

### Retry Logic

```typescript
// src/utils/retry.ts
import { logger } from './logger.js';

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; retryableStatuses?: number[] } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, retryableStatuses = [429, 500, 502, 503] } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err.status;
      const isRetryable = retryableStatuses.includes(status);

      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn({ attempt, delay, status }, 'Retrying OpenAI request');
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw new Error('Unreachable');
}
```

### Embeddings + Semantic Search

```typescript
// src/routes/content.ts
router.post('/search', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.body;
  if (!q) {
    res.status(400).json({ error: 'q is required' });
    return;
  }

  // Generate embedding for the query
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: q,
  });
  const embedding = embeddingResponse.data[0].embedding;

  // Vector similarity search
  const result = await pool.query(
    `SELECT id, prompt, response, tokens_used, created_at,
       1 - (embedding <=> $1) as score
     FROM contents
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [JSON.stringify(embedding), Math.min(50, parseInt(limit as string) || 10)]
  );

  res.json({ results: result.rows });
});
```

### Token Rate Limiting

```typescript
// src/routes/content.ts
router.post('/generate', moderatePrompt, async (req: Request, res: Response) => {
  const { prompt, max_tokens = 256, temperature = 0.7 } = req.body;
  const requestedTokens = Math.min(4096, Math.max(1, parseInt(max_tokens) || 256));

  const tokenUsageResult = await pool.query(
    `SELECT COALESCE(SUM(tokens_used), 0) as total FROM contents WHERE created_at > NOW() - INTERVAL '1 hour'`
  );
  const hourlyTokens = parseInt(tokenUsageResult.rows[0].total);
  const HOURLY_TOKEN_LIMIT = parseInt(process.env.HOURLY_TOKEN_LIMIT || '100000');

  if (hourlyTokens + requestedTokens > HOURLY_TOKEN_LIMIT) {
    res.status(429).json({ error: 'Token rate limit exceeded. Try again later.' });
    return;
  }

  // ... streaming logic
});
```

## Decisions

**Streaming: SSE vs WebSockets**
- Option A: WebSockets — bidirectional, persistent
- Option B: SSE — unidirectional, simpler, works over HTTP/1.1
- **Chosen: B** — the client only receives data; no need for bidirectional

**Embeddings: pgvector vs external vector DB**
- Option A: Pinecone / Weaviate — purpose-built, scalable
- Option B: pgvector — one less service, SQL joins possible
- **Chosen: B** — for < 1M vectors, PostgreSQL + pgvector is simpler

## Checklist

- [ ] Streaming uses `AbortController` with a 30s timeout
- [ ] Retry logic covers 429, 500, 502, 503 with exponential backoff
- [ ] Token usage is tracked and capped per hour
- [ ] Prompts are moderated via regex + OpenAI Moderation API
- [ ] Embeddings are stored in PostgreSQL with pgvector
- [ ] Semantic search uses `<=>` (cosine distance) operator
- [ ] All async operations have structured logging with `requestId`

## Post-Mortem: v7 Bugs

1. **No timeout on LLM stream** (fixed): Added `AbortController` with `MAX_STREAM_TIMEOUT_MS`
2. **No retry logic** (fixed): `withRetry` wrapper with exponential backoff
3. **No prompt moderation** (fixed): Regex filter + OpenAI Moderation API
4. **No token rate limiting** (fixed): Hourly sum query + 429 response

## Your Turn

- What happens if OpenAI streams a token every 29 seconds forever?
- How would you implement per-user token quotas instead of global?
- Should embeddings be generated synchronously or asynchronously?
