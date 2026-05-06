# v7 — Production Setup

Your code execution engine works locally. But production code execution is a security minefield. A sandbox escape is a CVE. An infinite loop is a DoS. A memory leak is a data breach. You need defense in depth.

## Pain #1: Container Breakouts

```typescript
// services/sandbox.ts
const container = await docker.createContainer({
  Image: 'node:20',
  HostConfig: {
    Memory: 256 * 1024 * 1024,
  },
});
// No seccomp profile. No capability dropping. No user namespace.
// A kernel vulnerability allows container escape.
// The attacker gains root on the host.
```

A user discovers that `/proc/self/exe` points to the host's runc binary. They exploit a known vulnerability and escape to the host. All submissions are compromised.

## Pain #2: Resource Exhaustion

```typescript
// services/executor.ts
const result = await sandbox.run(submission.code);
// No global rate limit. 1000 concurrent submissions.
// Each uses 256MB. Total: 256GB. The host OOMs.
// All services on the host die.
```

A popular coding challenge goes viral. 10,000 users submit simultaneously. The worker pool exhausts memory. The entire platform crashes.

## Pain #3: No Audit Trail

```typescript
// services/executor.ts
console.log('Submission completed', submission.id);
// No structured logging. No user attribution.
// A compliance officer asks: "Who ran this malicious code?"
// You have no answer.
```

A university uses your platform for exams. A student cheats by submitting code that leaks the test answers. The school demands to know who ran it. Your logs don't link submissions to users.

## Pain #4: Secret Leakage in Submissions

```typescript
// services/executor.ts
app.post('/run', async (req, res) => {
  const submission = req.body;
  // submission.code might contain:
  // console.log(process.env.STRIPE_SECRET_KEY)
  // Environment variables are exposed to sandboxed code.
});
```

A user submits `console.log(process.env)`. The sandbox can read the host's environment variables. AWS credentials, database passwords, and Stripe keys are exposed.

## The Fix: Production Execution Engine

### Defense in Depth: Container Security

```typescript
// src/services/sandbox.ts
import Docker from 'dockerode';

export async function createSandbox(config: SandboxConfig): Promise<Sandbox> {
  const container = await docker.createContainer({
    Image: config.image,
    HostConfig: {
      Memory: config.memoryLimitMb * 1024 * 1024,
      MemorySwap: config.memoryLimitMb * 1024 * 1024, // No swap
      NanoCpus: Math.floor(config.cpuLimitCores * 1e9),
      PidsLimit: 50, // Prevent fork bombs
      NetworkMode: config.networkDisabled ? 'none' : 'bridge',
      ReadonlyRootfs: true,
      SecurityOpt: [
        'no-new-privileges:true',
        'seccomp=./profiles/seccomp-default.json',
        'apparmor=docker-default',
      ],
      CapDrop: ['ALL'],
      CapAdd: config.needsNetwork ? ['NET_BIND_SERVICE'] : [],
      Tmpfs: {
        '/tmp': 'rw,noexec,nosuid,size=100M',
      },
    },
    // Run as unprivileged user inside container
    User: '1000:1000',
  });
  
  logger.info({
    containerId: container.id,
    image: config.image,
    seccomp: true,
    apparmor: true,
    noNewPrivileges: true,
    readOnlyRootfs: true,
  }, 'Sandbox created with security profile');
  
  return new DockerSandbox(container, config);
}
```

### Global Rate Limiting and Queue

```typescript
// src/services/queue.ts
import { Queue, Worker } from 'bullmq';

const submissionQueue = new Queue('submissions', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { age: 3600 }, // Keep for 1 hour
    removeOnFail: { age: 86400 }, // Keep failures for 24 hours
  },
});

export async function enqueueSubmission(submission: Submission): Promise<string> {
  // Global rate limit: max 100 submissions per user per minute
  const userKey = `rate_limit:${submission.userId}`;
  const current = await redis.incr(userKey);
  if (current === 1) await redis.expire(userKey, 60);
  
  if (current > 100) {
    throw new Error('Rate limit exceeded: max 100 submissions/minute');
  }
  
  const job = await submissionQueue.add('execute', submission, {
    priority: submission.userPlan === 'premium' ? 1 : 2,
  });
  
  return job.id!;
}

const worker = new Worker('submissions', async (job) => {
  const submission: Submission = job.data;
  logger.info({ jobId: job.id, submissionId: submission.id }, 'Executing submission');
  
  return executor.run(submission);
}, {
  connection: redis,
  concurrency: 10, // Max 10 concurrent sandboxes
  limiter: {
    max: 100,
    duration: 1000,
  },
});
```

### Immutable Audit Trail

```typescript
// src/services/audit.ts
import { Pool } from 'pg';

const auditDb = new Pool({ connectionString: process.env.AUDIT_DATABASE_URL });

export async function logExecution(
  submission: Submission,
  result: ExecutionResult
): Promise<void> {
  await auditDb.query(
    `INSERT INTO execution_audit (
      submission_id, user_id, user_email, language,
      code_hash, config, result_exit_code, result_stdout_hash,
      result_stderr_hash, execution_time_ms, memory_used_mb,
      sandbox_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
    [
      submission.id,
      submission.userId,
      submission.userEmail,
      submission.language,
      hashCode(submission.code),
      JSON.stringify(submission.config),
      result.exitCode,
      hashCode(result.stdout),
      hashCode(result.stderr),
      result.executionTimeMs,
      result.memoryUsedMb,
      result.sandboxId,
    ]
  );
  
  logger.info({ submissionId: submission.id, userId: submission.userId }, 'Execution audited');
}
```

### Environment Isolation

```typescript
// src/services/sandbox.ts
export async function createSandbox(config: SandboxConfig): Promise<Sandbox> {
  const container = await docker.createContainer({
    Image: config.image,
    Env: [
      'PATH=/usr/local/bin:/usr/bin:/bin',
      'HOME=/tmp',
      // Explicitly DO NOT pass host env vars
    ],
    HostConfig: {
      // ... security options
    },
  });
  
  return new DockerSandbox(container, config);
}
```

```typescript
// src/index.ts
import dotenv from 'dotenv';

dotenv.config();

// Only expose specific env vars to the app, never to sandboxes
const APP_ENV = ['PORT', 'LOG_LEVEL', 'DATABASE_URL', 'REDIS_URL'];
for (const key of Object.keys(process.env)) {
  if (!APP_ENV.includes(key)) {
    delete process.env[key];
  }
}
```

## What Changed

1. **Container security** — seccomp, AppArmor, no-new-privileges, read-only rootfs.
2. **Resource governance** — Global queue with per-user rate limits and concurrency caps.
3. **Audit compliance** — Immutable PostgreSQL audit trail with code hashes.
4. **Env isolation** — Sandboxes get minimal env vars. Host secrets are protected.

## Production Checklist

- [ ] seccomp-bpf profile blocking dangerous syscalls
- [ ] AppArmor or SELinux profiles
- [ ] No-new-privileges flag
- [ ] Read-only rootfs with limited tmpfs
- [ ] User namespace remapping (container root → unprivileged host user)
- [ ] Capability dropping (ALL) with minimal additions
- [ ] Global submission queue with per-user rate limits
- [ ] Worker concurrency limits (prevent host OOM)
- [ ] Immutable audit trail (who, what, when, how much)
- [ ] Environment variable isolation
- [ ] Sandbox image vulnerability scanning
- [ ] Network isolation (none or restricted bridge)

## The Evolution

| Stage | State |
|-------|-------|
| v1 | eval() in Express |
| v2 | TypeScript types for execution pipeline |
| v3 | Validation for resource limits and languages |
| v4 | Structured logging with security redaction |
| v5 | Tests for sandbox security and diff correctness |
| v6 | ESM for modern Dockerode and stream APIs |
| v7 | Production execution with defense in depth and compliance |

This is a production code execution engine. It handles sandboxed execution, resource limits, multi-language support, test evaluation, and audit compliance. It started as `eval()`. Now it's a LeetCode-scale platform.
