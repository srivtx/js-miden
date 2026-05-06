# v6 — Switch to ESM

Your code execution engine has tests, but CommonJS is limiting your sandbox and language runner architecture. Dockerode v4+ is ESM-first. Modern stream APIs are ESM-only.

## Pain #1: Dockerode Import Issues

```javascript
// CommonJS
const Docker = require('dockerode');
// dockerode v4 is ESM-only. require() throws.
// You pin dockerode to v3. v3 has security vulnerabilities.
```

You're stuck on an old Dockerode version because of CommonJS. You can't get security patches.

## Pain #2: Stream API Limitations

```javascript
// CommonJS
const { Readable } = require('stream');
// You want to use the new Web Streams API (ReadableStream)
// It's available globally in ESM, but not in CommonJS without flags.
```

The output capture module could be simpler with `ReadableStream`. But CommonJS forces you to use the legacy `stream` module.

## Pain #3: Dynamic Language Loading

```javascript
// CommonJS
const runners = {
  javascript: require('./runners/javascript'),
  python: require('./runners/python'),
  go: require('./runners/go'),
};
```

You want to load language runners dynamically based on the submission. In CommonJS, dynamic `require()` is synchronous but doesn't work well with async initialization (e.g., compiling Go runner).

## The Fix: ESM Migration

### package.json

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "start": "node dist/index.js"
  }
}
```

### Source Files

```typescript
// src/services/sandbox.ts
import Docker from 'dockerode';
import { logger } from '../utils/logger.js';
import type { SandboxConfig } from '../types/execution.js';

const docker = new Docker();

export async function createSandbox(config: SandboxConfig): Promise<Sandbox> {
  const container = await docker.createContainer({
    Image: config.image,
    HostConfig: {
      Memory: config.memoryLimitMb * 1024 * 1024,
      NanoCpus: Math.floor(config.cpuLimitCores * 1e9),
      NetworkMode: config.networkDisabled ? 'none' : 'bridge',
      ReadonlyRootfs: config.readOnlyRootfs,
      SecurityOpt: ['no-new-privileges:true'],
      CapDrop: ['ALL'],
    },
  });
  
  logger.info({ containerId: container.id }, 'Sandbox container created');
  return new DockerSandbox(container);
}
```

```typescript
// src/services/language.ts
import { logger } from '../utils/logger.js';
import type { Submission, ExecutionResult } from '../types/execution.js';

const runnerModules = new Map<string, () => Promise<LanguageRunner>>();

runnerModules.set('javascript', () => import('./runners/javascript.js'));
runnerModules.set('python', () => import('./runners/python.js'));
runnerModules.set('go', () => import('./runners/go.js'));

export async function getRunner(language: string): Promise<LanguageRunner> {
  const loader = runnerModules.get(language);
  if (!loader) {
    throw new Error(`Unsupported language: ${language}`);
  }
  const module = await loader();
  return module.default;
}
```

```typescript
// src/services/outputCapture.ts
import { logger } from '../utils/logger.js';

const MAX_OUTPUT_SIZE = 10 * 1024 * 1024;

export async function captureOutput(readable: ReadableStream<Uint8Array>): Promise<string> {
  const reader = readable.getReader();
  let output = '';
  let size = 0;
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      size += value.length;
      if (size > MAX_OUTPUT_SIZE) {
        logger.warn({ size }, 'Output limit exceeded');
        throw new Error('Output size limit exceeded');
      }
      
      output += new TextDecoder().decode(value);
    }
  } finally {
    reader.releaseLock();
  }
  
  return output;
}
```

## What Changed

1. **Modern Dockerode** — ESM-native import. Latest version with security patches.
2. **Web Streams API** — Clean `ReadableStream` with async iteration.
3. **Dynamic language loading** — Lazy imports for language runners.
4. **Type-safe imports** — `import type` for execution types.

## ESM for Code Execution

In a code execution engine, module stability is security. ESM gives you:
- **Latest dependencies** — No pinning to old CommonJS versions
- **Modern APIs** — Web Streams, AbortController, top-level await
- **Clean architecture** — Dynamic imports for plugin-like language support
- **Standard compliance** — Same patterns in Node.js and Deno/Bun

## Next Pain

The engine runs but has no graceful shutdown. Active sandboxes are orphaned on restart. Running submissions are lost. You need production setup.
