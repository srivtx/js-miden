# Core Concepts

## Linux Namespaces
Namespaces isolate system resources between processes, creating the illusion of separate systems.
- **PID namespace**: Process IDs are isolated. PID 1 inside the container is the init process, completely separate from the host PID table.
- **NET namespace**: Separate network stack (interfaces, routing tables, firewall rules). `--network none` removes all external connectivity.
- **MNT namespace**: Filesystem mount points are isolated. The container sees its own rootfs; host mounts are invisible unless explicitly shared.
- **UTS namespace**: Hostname and NIS domain name isolation.
- **IPC namespace**: Inter-process communication isolation (SysV message queues, shared memory, semaphores).
- **USER namespace**: Maps container root (UID 0) to an unprivileged host user. This is the last line of defense: even if the attacker escapes the container, they are a nobody user on the host.

## cgroups (Control Groups)
cgroups limit and account for resource usage per process group.
- **v1**: Separate hierarchies for `cpu`, `memory`, `pids`, `blkio`. Files like `memory.limit_in_bytes` set hard caps.
- **v2**: Unified hierarchy under a single mount point. Uses `memory.max` for hard limit and `cpu.max` for bandwidth quota/period.
- **pids.max**: Prevents fork bombs by limiting the number of processes that can exist in a cgroup. Essential for any code runner.

## seccomp-bpf
Secure Computing Mode filters syscalls using Berkeley Packet Filter bytecode.
- **Default action**: `SCMP_ACT_ERRNO` (deny) or `SCMP_ACT_ALLOW`.
- **Docker default profile**: Blocks ~44 dangerous syscalls (`mount`, `swapon`, `reboot`, etc.) but allows many others.
- **Custom profiles**: For a code runner, we might block `openat`, `socket`, `execve` entirely and only allow `read`, `write`, `exit`, `exit_group`. This minimizes the kernel attack surface to the absolute minimum.

## Stream Backpressure
Node.js streams use backpressure to signal that the consumer is slower than the producer.
- `readable.pause()` stops emitting `data` events.
- `readable.resume()` resumes them.
- Without explicit backpressure handling, internal buffers grow unbounded until memory is exhausted.
- Our bug is a failure to apply backpressure **and** a missing aggregate size check on the accumulated output string.

## Diff Algorithms
- **LCS (Longest Common Subsequence)**: Produces a minimal set of insertions and deletions. Dynamic programming solution is O(n*m) time and space.
- **Myers Algorithm**: O(ND) where D is the number of differences. Much faster for typical code diffs where D is small. Used in `git diff`.
- **Patience Diff**: Better for code with moved blocks. Used in `git diff --patience`.

## Container Security Layers
Defense in depth for code execution:
1. **Capability dropping**: `--cap-drop=ALL` removes all 41 Linux capabilities.
2. **Read-only rootfs**: `--read-only` prevents writing to the container image.
3. **Tmpfs with size limit**: `--tmpfs /tmp:size=100M` allows writes only to a limited ephemeral filesystem.
4. **No new privileges**: `--security-opt no-new-privileges:true` prevents privilege escalation via setuid binaries.
5. **User remapping**: Map container root to a high host UID to contain breakout damage.
