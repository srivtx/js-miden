# Old vs New Approaches

## The Old Way: Raw Eval and Exec
Early online judges and REPL backends used `eval()` or `child_process.exec('python -c "' + code + '"')`.
- **No isolation**: Code runs in the same OS process and memory space as the web server.
- **No resource limits**: Infinite loops hang the event loop or spawn uncontrolled child processes.
- **String concatenation injection**: Escaping errors led to shell command injection (`'; rm -rf /; '`).
- **Synchronous blocking**: `execSync` blocks the entire thread pool, destroying throughput under load.
- **No output limits**: A single `while(true) console.log('x')` crashes the server via OOM.

## The New Way: Containerized Sandboxing
Modern platforms use layered isolation that treats every submission as a hostile actor.
- **Process isolation**: Docker PID namespaces ensure the submission cannot see, signal, or ptrace host processes.
- **Kernel-level resource limits**: cgroups enforce hard memory and CPU ceilings that the guest cannot override.
- **Syscall filtering**: seccomp reduces the kernel attack surface to a minimal allow-list.
- **Read-only rootfs**: The container filesystem is immutable; all writes go to an ephemeral overlay with size caps.
- **Stream-based capture**: Output is consumed incrementally with bounded buffers rather than accumulated in monolithic strings.
- **Queue-based workers**: Submissions are decoupled from HTTP request handlers, allowing independent horizontal scaling of API and worker tiers.

## Comparison Table

| Dimension | Old Approach | New Approach |
|-----------|-------------|--------------|
| Isolation | None | Namespaces + cgroups + seccomp |
| Resource Limits | None | Kernel-enforced |
| Startup Time | Instant | 100-500ms (mitigated by warm pools) |
| Language Support | Single (JS) | Universal (any OCI image) |
| Security Incidents | Frequent RCE | Rare (requires kernel 0-day) |
| Output Safety | Unbounded strings | Bounded ring buffers |
| Scalability | Vertical only | Horizontal worker pools |

## The Evolution Path
Most platforms evolve through three stages:
1. **Eval stage** (prototyping): `vm2` or `eval`. Fast, completely insecure.
2. **Container stage** (growth): Docker + cgroups. Good enough for 99% of submissions.
3. **MicroVM stage** (scale): Firecracker, Kata, gVisor. Strongest isolation, lowest density risk.
This project targets stage 2 with architectural hooks for stage 3.
