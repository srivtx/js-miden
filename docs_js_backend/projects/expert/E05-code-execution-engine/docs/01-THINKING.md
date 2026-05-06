# Design Thinking

Building a code execution engine is fundamentally an exercise in **adversarial systems design**. Every line of code we write must assume the user is malicious. The thinking process can be decomposed into four adversarial pillars: isolation, resource governance, observability, and correctness.

## 1. Isolation Strategy

The first question is: *how do we run untrusted code without trusting it?*

- **Option A: Process-level isolation** (`child_process.spawn`). Fast, but trivially escapable via `require('child_process').exec('rm -rf /')` or v8 exploits.
- **Option B: Language-specific sandboxes** (e.g., `vm2`, `isolated-vm`). Good for JavaScript-only platforms, but each language requires a custom runtime. Also, `vm2` had critical sandbox escapes (CVE-2023-29017).
- **Option C: OS-level virtualization** (Docker containers with seccomp, namespaces, cgroups). Language-agnostic, battle-tested, and provides defense in depth.
- **Option D: Hardware virtualization** (Firecracker, Kata Containers, gVisor). Strongest isolation, but higher cold-start latency and operational complexity.

**Decision**: For an educational backend, Option C (Docker) is the sweet spot. It teaches Linux security primitives while remaining deployable on a single developer machine. We will stub the Docker integration using `dockerode` and provide a local fallback spawn path for unit testing.

## 2. Resource Governance

Even inside a container, a fork bomb or memory-heavy allocation can starve the host. We need kernel-enforced limits.

- **Time**: Node.js `setTimeout` is insufficient because it doesn't account for blocking syscalls. We need a parent process that sends `SIGKILL` after the wall-clock limit.
- **Memory**: JavaScript's `v8.getHeapStatistics()` only measures the JS heap. A C++ addon or Go binary could allocate native memory outside V8. We must use cgroup `memory.limit_in_bytes` (v1) or `memory.max` (v2).
- **Output**: Streams are deceptively dangerous. If a process writes 10GB to stdout and we buffer it in a string, we defeat the purpose of memory limits. We need a bounded buffer or a ring buffer. This is where our intentional bug lives—we consciously omit the bound to demonstrate the failure mode.

## 3. Execution Model

- **Synchronous HTTP**: Simple for the client, but long-running submissions block threads. Express 5 handles this better with async route handlers, but a 10s submission still ties up an HTTP connection.
- **Asynchronous Queue**: Submissions return a `jobId`. A worker pool polls Redis (or an in-memory queue) and executes jobs. This decouples ingestion from execution and allows horizontal scaling of workers.

**Decision**: We implement a synchronous stub for simplicity in tests, but architect the `executor.ts` service to accept a pluggable strategy so the queue model is a natural extension.

## 4. Diffing and Correctness

Test case evaluation requires more than `===`. We need:
- Trailing newline normalization (`\n` vs `\r\n`).
- Whitespace-agnostic modes (optional).
- Line-level diff for large outputs so the user sees exactly which line failed.

We will implement a Longest Common Subsequence (LCS) diff in `src/utils/diff.ts`. This is educational and avoids the dependency weight of `diff` libraries while teaching dynamic programming.

## 5. Threat Model

| Threat | Mitigation |
|--------|------------|
| Sandbox escape via kernel exploit | Keep Docker daemon patched; use gVisor in production |
| Fork bomb | cgroup `pids.max` |
| Network egress | `--network none` in Docker stub |
| Disk exhaustion | tmpfs size limits, read-only rootfs |
| Output DoS | **Missing** — intentional bug |
| Host metadata leak | Mask `/proc` and environment variables |

## Conclusion

The engine is a composite of micro-decisions where security is the primary constraint and performance is secondary. The architecture is modular so that the sandbox backend can be swapped from local spawn → Docker → Firecracker without changing the API or test runner.
