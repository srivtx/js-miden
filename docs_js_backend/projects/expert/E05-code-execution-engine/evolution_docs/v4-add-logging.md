# v4 — Add Logging

Your code execution engine runs untrusted code in Docker containers. When a submission fails or a sandbox escapes, you have no forensic record of what happened.

## Pain #1: Sandbox Deaths Without Autopsy

```typescript
// services/executor.ts (before)
async function runSubmission(submission) {
  try {
    const result = await sandbox.run(submission);
    console.log('Submission completed', result.exitCode);
    return result;
  } catch (error) {
    console.error('Submission failed', error);
    throw error;
  }
}
```

A sandbox is killed by the OOM killer. The log says `"Submission failed"` with a generic error. You can't determine:
- Which user submitted the code
- What language and code was run
- What resource limits were configured
- How long it ran before death
- Whether the output capture was the cause

## Pain #2: Security Incidents Without Evidence

```typescript
// services/sandbox.ts (before)
function createContainer(config) {
  console.log('Creating container', config.image);
  return docker.createContainer({
    Image: config.image,
    HostConfig: { Memory: config.memoryLimitMb * 1024 * 1024 },
  });
}
```

A container escapes its namespace. The log shows it was created but not:
- The seccomp profile applied
- The capabilities dropped
- Whether the rootfs was read-only
- The user namespace mapping
- Network mode configuration

## Pain #3: Test Evaluation Without Transparency

```typescript
// services/testRunner.ts (before)
function evaluateTest(output, expected) {
  console.log('Evaluating test');
  const passed = output.trim() === expected.trim();
  console.log('Test result:', passed);
  return passed;
}
```

A user contests a failed test. The log says `"Test result: false"` but not:
- The actual output (truncated or full)
- The expected output
- The diff between them
- Whether whitespace normalization was applied

## The Fix: Structured Logging with Security Context

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'executor',
    version: process.env.SERVICE_VERSION,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['code', 'submission.code'],
    censor: '[REDACTED]',
  },
});

export function createSubmissionLogger(submissionId: string, userId: string) {
  return logger.child({ submissionId, userId, context: 'submission' });
}

export function createSandboxLogger(sandboxId: string) {
  return logger.child({ sandboxId, context: 'sandbox' });
}
```

```typescript
// src/services/executor.ts
import { logger, createSubmissionLogger } from '../utils/logger.js';

export async function runSubmission(submission: Submission): Promise<ExecutionResult> {
  const log = createSubmissionLogger(submission.id, submission.userId);
  const startTime = Date.now();
  
  log.info({
    language: submission.language,
    testCount: submission.testCases.length,
    config: submission.config,
  }, 'Submission execution started');
  
  try {
    const sandbox = await createSandbox(submission.config);
    const sandboxLog = createSandboxLogger(sandbox.id);
    
    sandboxLog.info({
      image: submission.config.image,
      memoryLimitMb: submission.config.memoryLimitMb,
      cpuLimitCores: submission.config.cpuLimitCores,
      networkDisabled: submission.config.networkDisabled,
      readOnlyRootfs: submission.config.readOnlyRootfs,
    }, 'Sandbox created');
    
    const result = await sandbox.run(submission.code, submission.testCases);
    
    log.info({
      durationMs: Date.now() - startTime,
      exitCode: result.exitCode,
      executionTimeMs: result.executionTimeMs,
      memoryUsedMb: result.memoryUsedMb,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
    }, 'Submission execution completed');
    
    return result;
  } catch (error: any) {
    log.error({
      err: error,
      durationMs: Date.now() - startTime,
    }, 'Submission execution failed');
    throw error;
  }
}
```

```typescript
// src/services/testRunner.ts
import { logger } from '../utils/logger.js';

export function evaluateTest(
  testCase: TestCase,
  actualOutput: string
): TestResult {
  const log = logger.child({ testCaseId: testCase.id, context: 'test' });
  
  const normalizedActual = actualOutput.trim().replace(/\r\n/g, '\n');
  const normalizedExpected = testCase.expectedOutput.trim().replace(/\r\n/g, '\n');
  const passed = normalizedActual === normalizedExpected;
  
  const diff = passed ? [] : generateDiff(normalizedActual, normalizedExpected);
  
  log.info({
    passed,
    actualLength: normalizedActual.length,
    expectedLength: normalizedExpected.length,
    diffLines: diff.length,
    isPublic: testCase.isPublic,
  }, 'Test evaluated');
  
  return {
    testCaseId: testCase.id,
    passed,
    actualOutput: testCase.isPublic ? normalizedActual : '[hidden]',
    expectedOutput: testCase.isPublic ? normalizedExpected : '[hidden]',
    diff: testCase.isPublic ? diff : [],
    executionTimeMs: 0,
  };
}
```

## Log Output Example

```json
{
  "level": 30,
  "time": "2025-01-15T20:15:42.333Z",
  "service": "executor",
  "version": "1.3.0",
  "submissionId": "sub_abc123",
  "userId": "user_456",
  "context": "submission",
  "language": "javascript",
  "testCount": 5,
  "config": {
    "memoryLimitMb": 256,
    "cpuLimitCores": 1,
    "timeoutMs": 2000,
    "networkDisabled": true,
    "readOnlyRootfs": true
  },
  "durationMs": 1842,
  "exitCode": 0,
  "executionTimeMs": 1234,
  "memoryUsedMb": 45,
  "stdoutLength": 120,
  "stderrLength": 0,
  "msg": "Submission execution completed"
}
```

## What Changed

1. **Execution transparency** — Every submission logs config, duration, and resource usage.
2. **Sandbox audit** — Container security settings are logged at creation.
3. **Test fairness** — Diff generation and visibility rules are logged.
4. **Security redaction** — User code is censored in logs to protect IP.

## Logging as Forensics

In code execution, logs are evidence. When a sandbox escapes, auditors need to know exactly what seccomp profile was applied. When a user contests a verdict, you need the exact diff. Logging is your legal and technical defense.

## Next Pain

You add output limits to prevent OOM. But you have no test that verifies a 10MB output is rejected. A regression could reintroduce the bug. You need automated testing.
