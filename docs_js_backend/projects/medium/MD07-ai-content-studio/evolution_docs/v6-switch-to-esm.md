# MD07 AI Content Studio — v6 Switch to ESM

> **Motto**: ESM is the future; CommonJS is the past.

## What Changed

Converted the entire codebase from CommonJS (`require`, `module.exports`) to ESM (`import`, `export`). Updated `tsconfig.json` to `"module": "NodeNext"`, renamed imports to include `.js` extensions, and switched the OpenAI SDK to its ESM build.

## Why

- **Tree-shaking**: OpenAI SDK drops unused endpoints under ESM
- **Top-level await**: `await openai.models.list()` in module scope for health checks
- **Future-proof**: Node.js 20+ treats ESM as first-class; CommonJS is legacy

## Architecture

No architecture change — same boxes, better wires.

## Code

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

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

## Decisions

**Option A: Keep CommonJS, use dynamic import for ESM-only deps**
- Pros: Zero migration cost
- Cons: Fragmented codebase, loses top-level await

**Option B: Full ESM migration**
- Pros: Clean, consistent, future-proof
- Cons: Must add `.js` extensions to all relative imports

**Chosen: B** — the project is medium-sized; migration took 30 minutes.

## Problems We Accepted

- Some `@types/*` packages assume CommonJS; needed to update `tsconfig.json` `esModuleInterop`
- `__dirname` no longer exists; replaced with `fileURLToPath(import.meta.url)`
- Vitest config needed `globals: false` to avoid CJS interop issues

## Checklist

- [ ] `"type": "module"` is in `package.json`
- [ ] All relative imports end with `.js`
- [ ] `tsconfig.json` uses `"module": "NodeNext"`
- [ ] No `require()` or `module.exports` remains in `src/`
- [ ] Tests pass under ESM (vitest handles this natively)

## Next Step

Production setup: streaming, retry logic, timeouts, embeddings, and full moderation.
