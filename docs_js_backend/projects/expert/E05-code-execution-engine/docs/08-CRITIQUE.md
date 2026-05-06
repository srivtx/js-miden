# Critique

## Strengths
1. **Modularity**: The separation of executor, sandbox, language, and test runner allows swapping backends (local → Docker → Firecracker) without touching business logic.
2. **Type Safety**: TypeScript prevents a class of runtime errors in the orchestration layer, especially around the async lifecycle of sandboxed processes.
3. **Testability**: The local spawn stub enables fast unit tests without requiring a Docker daemon, improving CI/CD speed.
4. **Educational Value**: The codebase demonstrates real security primitives (seccomp, cgroups, namespaces) rather than toy examples.

## Weaknesses
1. **Incomplete Sandbox**: The Docker integration is a stub. Real production requires gVisor/Firecracker, tuned seccomp profiles, and AppArmor/SELinux policies.
2. **No Network Isolation in Local Stub**: The local spawn path for tests does not disable network access. A test could accidentally fetch external resources or exfiltrate data.
3. **Naive Diff Algorithm**: LCS is O(n*m). For outputs with thousands of lines, this becomes a CPU bottleneck. Myers algorithm or a library like `diff` would be better.
4. **Missing Disk I/O Limits**: cgroups v2 has `io.max`, but our stub does not configure it. A submission could write an enormous file to `/tmp` and exhaust disk.
5. **No Warm Pool**: Each Docker cold start adds latency. Production systems maintain a pool of idle containers (e.g., LeetCode's approach).
6. **Single-Process Architecture**: The API and worker are colocated. In production, they should be separate deployables with a message queue (Redis/BullMQ).

## What We Would Do Differently
- Implement a **ring buffer** for output capture so users still see the tail of excessive output rather than a hard truncation.
- Use a message queue (BullMQ over Redis) for async job processing with retry and dead-letter semantics.
- Add OpenTelemetry tracing for sandbox lifecycle events (spawn, kill, OOM).
- Implement a proper seccomp JSON profile and load it via `docker run --security-opt seccomp=profile.json`.
- Add a **warm pool** service that pre-creates containers and recycles them after each run.
