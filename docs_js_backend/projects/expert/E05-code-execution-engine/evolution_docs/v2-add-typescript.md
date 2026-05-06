# v2 — Add TypeScript

Your code execution engine handles multiple languages, Docker containers, resource limits, and test case diffing. Type mismatches between these layers cause crashes and wrong results.

## Pain #1: Language Runner Return Shape

```js
// services/language.js
async function runJavaScript(code, input) {
  // Returns { stdout, stderr, exitCode, executionTime }
}

async function runPython(code, input) {
  // Returns { output, error, status, timeMs }
  // Different field names!
}
```

The executor expects `stdout` but Python returns `output`. The test runner sees `undefined` and marks every test as failed.

## Pain #2: Sandbox Config Drift

```js
// services/sandbox.js
function createSandbox(language, code, options) {
  return {
    image: options.image || 'node:20',
    memory: options.memLimit || '256m', // some use memLimit, some use memoryLimit
    cpu: options.cpuLimit || '1.0',
  };
}
```

One caller passes `memoryLimit: '512m'`. The sandbox ignores it. The default `256m` is used. A memory-heavy submission crashes the container instead of being killed gracefully.

## Pain #3: Test Case Mismatch

```js
// services/testRunner.js
function evaluateTest(output, expected) {
  return output.trim() === expected.trim();
}
```

`expected` is sometimes an array of lines, sometimes a single string. The comparison fails silently. Users get wrong verdicts.

## The Fix: TypeScript

```ts
// src/types/execution.ts
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  memoryUsedMb: number;
}

export interface SandboxConfig {
  image: string;
  memoryLimitMb: number;
  cpuLimitCores: number;
  timeoutMs: number;
  maxOutputSizeMb: number;
  networkDisabled: boolean;
  readOnlyRootfs: boolean;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isPublic: boolean;
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  actualOutput: string;
  expectedOutput: string;
  diff: string[];
  executionTimeMs: number;
}

export interface Submission {
  id: string;
  language: 'javascript' | 'python' | 'go';
  code: string;
  testCases: TestCase[];
  config: SandboxConfig;
}
```

```ts
// src/services/sandbox.ts
import { SandboxConfig } from '../types/execution.js';

export function createSandbox(config: SandboxConfig): DockerRunOptions {
  return {
    Image: config.image,
    HostConfig: {
      Memory: config.memoryLimitMb * 1024 * 1024,
      NanoCpus: Math.floor(config.cpuLimitCores * 1e9),
      NetworkMode: config.networkDisabled ? 'none' : 'bridge',
      ReadonlyRootfs: config.readOnlyRootfs,
    },
  };
}
```

## What Changed

1. **Unified result shape** — every language runner returns `ExecutionResult`
2. **Sandbox safety** — `memoryLimitMb` is a number. No string parsing ambiguity.
3. **Test case integrity** — `expectedOutput` is always a string. Arrays are rejected.
4. **Config validation** — missing fields are compile errors, not runtime surprises.

## Trade-Offs

- **Language runner stubs** — you need adapters for each language to conform to `ExecutionResult`
- **Docker types** — `@types/dockerode` helps but doesn't cover every API edge case
- **Runtime validation still needed** — user-submitted code is untrusted; types don't help there

## Migration Path

```bash
# 1. Define execution types
mkdir src/types
# ExecutionResult, SandboxConfig, TestCase, TestResult, Submission

# 2. Type the most critical path first
# sandbox.ts → language runners → testRunner.ts → executor.ts

# 3. Add strict null checks
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```

## Result

Language runner return shapes are uniform. Sandbox configs are always complete. Test evaluations are consistent. The execution pipeline is type-safe end-to-end.
