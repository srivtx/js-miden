# v5 — Add Testing

Your code execution engine has logging, but sandbox escapes reach production. A memory limit change allows OOM on the host. A language runner refactor breaks Python execution. You need defense in depth.

## Pain #1: Sandbox Escape Regression

You update the Docker base image for faster startup. The new image has a different seccomp profile. A user discovers they can now write to `/tmp`. They escalate to reading `/etc/passwd`. The escape works because the new image doesn't mount `/tmp` as noexec.

## Pain #2: Resource Limit Bypass

You refactor resource limits to use cgroups v2. The memory limit is now specified in `memory.max` instead of `memory.limit_in_bytes`. But the code still reads the old value for validation. A submission with 512MB limit actually gets unlimited memory.

## Pain #3: Test Evaluation Wrong Verdicts

You optimize the diff algorithm for large outputs. The optimization skips trailing whitespace comparison. A test where expected output is `"hello\n"` and actual is `"hello"` now passes incorrectly. Users get accepted for wrong answers.

## The Fix: Layered Testing Strategy

### Unit Tests: Output Capture Limits

```typescript
// tests/unit/outputCapture.test.ts
import { describe, it, expect } from 'vitest';
import { captureOutput } from '../../src/services/outputCapture.js';
import { Readable } from 'stream';

describe('Output capture', () => {
  it('should capture stdout correctly', async () => {
    const stream = Readable.from(['Hello', ' ', 'World']);
    const output = await captureOutput(stream);
    expect(output).toBe('Hello World');
  });
  
  it('should reject output exceeding limit', async () => {
    const longOutput = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const stream = Readable.from([longOutput]);
    
    await expect(captureOutput(stream, 10 * 1024 * 1024))
      .rejects.toThrow('Output size limit exceeded');
  });
  
  it('should handle empty output', async () => {
    const stream = Readable.from([]);
    const output = await captureOutput(stream);
    expect(output).toBe('');
  });
  
  it('should handle stderr interleaved with stdout', async () => {
    const stream = Readable.from(['out1\n', 'err1\n', 'out2\n']);
    const output = await captureOutput(stream);
    expect(output).toBe('out1\nerr1\nout2\n');
  });
});
```

### Unit Tests: Diff Algorithm

```typescript
// tests/unit/diff.test.ts
import { describe, it, expect } from 'vitest';
import { generateDiff } from '../../src/utils/diff.js';

describe('Diff generation', () => {
  it('should detect exact match', () => {
    const diff = generateDiff('hello\nworld', 'hello\nworld');
    expect(diff.every(line => line.startsWith(' '))).toBe(true);
  });
  
  it('should detect missing line', () => {
    const diff = generateDiff('hello\nworld', 'hello');
    expect(diff.some(line => line.startsWith('-'))).toBe(true);
  });
  
  it('should detect extra line', () => {
    const diff = generateDiff('hello', 'hello\nworld');
    expect(diff.some(line => line.startsWith('+'))).toBe(true);
  });
  
  it('should detect whitespace differences', () => {
    const diff = generateDiff('hello ', 'hello');
    expect(diff.some(line => line.includes('whitespace'))).toBe(true);
  });
  
  it('should handle large outputs efficiently', () => {
    const a = Array.from({ length: 1000 }, (_, i) => `line_${i}`).join('\n');
    const b = Array.from({ length: 1000 }, (_, i) => `line_${i}`).join('\n');
    
    const start = Date.now();
    const diff = generateDiff(a, b);
    const duration = Date.now() - start;
    
    expect(diff).toHaveLength(1000);
    expect(duration).toBeLessThan(100); // Should be fast
  });
});
```

### Integration Tests: Sandbox Security

```typescript
// tests/integration/sandbox.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createSandbox } from '../../src/services/sandbox.js';

describe('Sandbox security', () => {
  it('should prevent file system escape', async () => {
    const sandbox = await createSandbox({
      image: 'node:20-alpine',
      memoryLimitMb: 256,
      networkDisabled: true,
      readOnlyRootfs: true,
    });
    
    const result = await sandbox.run(`
      const fs = require('fs');
      try {
        fs.readFileSync('/etc/passwd');
        console.log('ESCAPE');
      } catch (e) {
        console.log('BLOCKED');
      }
    `);
    
    expect(result.stdout).toContain('BLOCKED');
    expect(result.stdout).not.toContain('ESCAPE');
  });
  
  it('should enforce memory limits', async () => {
    const sandbox = await createSandbox({
      image: 'node:20-alpine',
      memoryLimitMb: 64,
      networkDisabled: true,
    });
    
    const result = await sandbox.run(`
      const arr = [];
      for (let i = 0; i < 10000000; i++) {
        arr.push('x'.repeat(1000));
      }
    `);
    
    expect(result.exitCode).not.toBe(0); // Should be killed
    expect(result.stderr).toContain('out of memory');
  });
  
  it('should enforce CPU time limits', async () => {
    const sandbox = await createSandbox({
      image: 'node:20-alpine',
      memoryLimitMb: 256,
      timeoutMs: 1000,
    });
    
    const result = await sandbox.run(`
      while (true) {}
    `);
    
    expect(result.exitCode).not.toBe(0);
    expect(result.executionTimeMs).toBeLessThanOrEqual(1200);
  });
  
  it('should block network access', async () => {
    const sandbox = await createSandbox({
      image: 'node:20-alpine',
      memoryLimitMb: 256,
      networkDisabled: true,
    });
    
    const result = await sandbox.run(`
      const https = require('https');
      https.get('https://example.com', (res) => {
        console.log('NETWORK_ALLOWED');
      }).on('error', (e) => {
        console.log('NETWORK_BLOCKED');
      });
    `);
    
    expect(result.stdout).toContain('NETWORK_BLOCKED');
  });
});
```

### Integration Tests: End-to-End Execution

```typescript
// tests/integration/execution.test.ts
import { describe, it, expect } from 'vitest';
import { runSubmission } from '../../src/services/executor.js';

describe('End-to-end execution', () => {
  it('should execute JavaScript and return output', async () => {
    const result = await runSubmission({
      language: 'javascript',
      code: 'console.log("Hello, World!");',
      testCases: [],
      config: { memoryLimitMb: 256, timeoutMs: 2000 },
    });
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Hello, World!\n');
  });
  
  it('should evaluate test cases correctly', async () => {
    const result = await runSubmission({
      language: 'javascript',
      code: 'const n = parseInt(process.argv[2]); console.log(n * 2);',
      testCases: [
        { id: 't1', input: '5', expectedOutput: '10', isPublic: true },
        { id: 't2', input: '0', expectedOutput: '0', isPublic: true },
        { id: 't3', input: '-3', expectedOutput: '-6', isPublic: false },
      ],
      config: { memoryLimitMb: 256, timeoutMs: 2000 },
    });
    
    expect(result.testResults).toHaveLength(3);
    expect(result.testResults[0].passed).toBe(true);
    expect(result.testResults[1].passed).toBe(true);
    expect(result.testResults[2].passed).toBe(true);
  });
  
  it('should handle compilation errors', async () => {
    const result = await runSubmission({
      language: 'javascript',
      code: 'console.log("missing quote);',
      testCases: [],
      config: { memoryLimitMb: 256, timeoutMs: 2000 },
    });
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('SyntaxError');
  });
});
```

## What Changed

1. **Output safety** — Limits are tested with oversized streams.
2. **Diff correctness** — Whitespace, large outputs, and exact matches are verified.
3. **Sandbox security** — File escape, memory, CPU, and network are all tested.
4. **End-to-end integrity** — Full submission lifecycle from code to verdict.

## Testing as Security Verification

In a code execution engine, tests are your security audit. A test that verifies `/etc/passwd` can't be read is as important as a test that verifies `2+2=4`. Without these tests, every Docker update is a potential sandbox escape.

## Next Pain

Tests run but imports use `require()` and dynamic `import()` in tests is inconsistent. You need ESM for cleaner test code and better mocking.
