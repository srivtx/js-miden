# v3 — Add Validation

Your code execution engine accepts arbitrary code and configuration from users. Without validation, a single bad request can crash containers, exhaust memory, or execute forever.

## Pain #1: Resource Limit Bypass

```typescript
// services/executor.ts (before)
function execute(submission) {
  const config = {
    memoryLimit: submission.memoryLimit || 256,
    timeout: submission.timeout || 2000,
  };
  // submission.memoryLimit might be 'unlimited'
  // submission.timeout might be -1
}
```

A user sends `timeout: -1`. The executor treats it as truthy. The default `2000` is skipped. The submission runs forever. The worker is blocked.

## Pain #2: Malicious Language Selection

```typescript
app.post('/run', async (req, res) => {
  const { language, code } = req.body;
  const runner = runners[language];
  // language might be 'bash'. runners['bash'] might exist for internal use.
  const result = await runner(code);
});
```

A user discovers `language: 'bash'` is supported internally. They run `rm -rf /` inside the container. Even with Docker, a misconfigured container escapes.

## Pain #3: Oversized Output DoS

```typescript
// services/outputCapture.ts
let output = '';
stream.on('data', (chunk) => {
  output += chunk.toString();
  // No limit. output grows unbounded.
});
```

A user runs `while (true) { console.log('x'.repeat(1000)); }`. Output hits 4GB. The Node.js process is killed by the OOM killer. All concurrent submissions die.

## The Fix: Zod Validation + Resource Guards

```typescript
// src/validation/execution.ts
import { z } from 'zod';

export const LanguageSchema = z.enum(['javascript', 'python', 'go']);

export const SandboxConfigSchema = z.object({
  memoryLimitMb: z.number().int().min(16).max(4096).default(256),
  cpuLimitCores: z.number().min(0.1).max(4).default(1),
  timeoutMs: z.number().int().min(100).max(30000).default(2000),
  maxOutputSizeMb: z.number().int().min(1).max(100).default(10),
  networkDisabled: z.boolean().default(true),
  readOnlyRootfs: z.boolean().default(true),
});

export const TestCaseSchema = z.object({
  id: z.string().min(1),
  input: z.string().max(10000),
  expectedOutput: z.string().max(10000),
  isPublic: z.boolean(),
});

export const SubmissionSchema = z.object({
  language: LanguageSchema,
  code: z.string().min(1).max(100000),
  testCases: z.array(TestCaseSchema).max(50),
  config: SandboxConfigSchema,
});
```

```typescript
// src/routes/execution.ts
import { SubmissionSchema } from '../validation/execution.js';

app.post('/run', async (req, res) => {
  const result = SubmissionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Invalid submission',
      details: result.error.issues,
    });
  }

  const submission = result.data;
  // Guaranteed: language is JS/Python/Go
  // Guaranteed: code <= 100KB, testCases <= 50
  // Guaranteed: timeout 100ms-30s, memory 16MB-4GB

  const executionResult = await executor.run(submission);
  res.json(executionResult);
});
```

```typescript
// src/services/outputCapture.ts
import { logger } from '../utils/logger.js';

const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB

export function captureOutput(stream: ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    let size = 0;

    stream.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_SIZE) {
        stream.destroy();
        logger.warn('Output limit exceeded', { size });
        reject(new Error('Output size limit exceeded'));
        return;
      }
      output += chunk.toString('utf-8');
    });

    stream.on('end', () => resolve(output));
    stream.on('error', reject);
  });
}
```

## What Changed

1. **Language restriction** — Only `javascript`, `python`, `go`. No `bash`, `sh`, `ruby`.
2. **Resource boundaries** — Memory 16MB-4GB. Timeout 100ms-30s. Output max 10MB.
3. **Output safety** — Streams are destroyed when limits are hit. No OOM.
4. **Code size limits** — Submissions max 100KB. No multi-megabyte payloads.

## Validation as Isolation

In a code execution engine, validation is the first line of defense before the sandbox. By rejecting bad configs at the edge, you prevent resource exhaustion from ever reaching Docker.

## Next Pain

When a sandbox is killed for memory limits, you have no record of why. Logs are scattered across workers. You need structured logging.
