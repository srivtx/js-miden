# MD07 AI Content Studio — v4 Add Logging

> **Motto**: Log every token.

## What Changed

Replaced `console.log` with `pino` structured JSON logging. Every generation request gets a `requestId`. Token usage is logged per request. Added correlation IDs across async boundaries (OpenAI API → our API → database).

## Why

- **Cost auditing**: Finance needs to know who burned 1M tokens last Tuesday
- **Debugging**: A user says "the model returned gibberish" — search by `requestId` to see the exact prompt and response
- **Alerting**: Log-based metrics (`error` level > 5/min) trigger PagerDuty
- **Compliance**: Some industries require audit trails for AI-generated content

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│   Express       │─────▶│    OpenAI       │
│  (Writer)   │      │  + pino logger  │      │   API           │
└─────────────┘      └────────┬────────┘      └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  stdout /    │
                       │  log shipper │
                       └──────────────┘
```

## Code

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'ai-content-studio' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// src/routes/content.ts
import { logger } from '../utils/logger.js';

app.post('/generate', moderatePrompt, async (req, res) => {
  const requestId = (req as any).requestId;
  const log = logger.child({ requestId, route: 'POST /generate' });

  const { prompt, max_tokens, temperature } = req.body;
  log.info({ promptLength: prompt.length, max_tokens, temperature }, 'Starting generation');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens,
      temperature,
    });

    const usage = completion.usage;
    log.info({ usage, model: completion.model }, 'Generation complete');

    res.json({ response: completion.choices[0].message.content });
  } catch (err) {
    log.error({ err }, 'OpenAI generation failed');
    res.status(502).json({ error: 'AI provider error' });
  }
});
```

## Decisions

**Option A: Winston**
- Pros: Transports, formatting
- Cons: Slower, heavier config

**Option B: Pino**
- Pros: Fast, structured by default, ESM-friendly
- Cons: Fewer built-in transports

**Chosen: Pino** — we ship logs to stdout and let the platform handle aggregation.

## Problems We Accepted

- Logs are stdout-only; no log aggregation configured yet
- No automatic redaction of prompts (PII could leak into logs)
- Token usage is logged but not yet rate-limited

## Checklist

- [ ] `logger.child()` is used per-request so `requestId` is in every log line
- [ ] Token usage (`prompt_tokens`, `completion_tokens`) is logged for every generation
- [ ] Error logs include the full error object and request context
- [ ] Prompts are NOT logged at `info` level (to avoid PII leakage)

## Next Step

Add tests so we can refactor safely.
