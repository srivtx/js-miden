# Research & Real-World Incidents

## CodeRunner.io Sandbox Escape (2017)
Security researchers demonstrated that CodeRunner.io's seccomp profile did not block `ptrace`. By attaching to the runner process from inside the container, they injected shellcode and escaped to the host. This highlights that **seccomp whitelist completeness** is critical: a single missing syscall can void the entire sandbox.

## vm2 / isolated-vm Vulnerabilities
- **CVE-2023-29017**: `vm2`, a widely-used Node.js sandbox library, had a prototype pollution escape leading to remote code execution on the host. The project is now deprecated.
- **CVE-2023-37903**: `isolated-vm` had a V8 type confusion bug allowing sandbox escape.
- **Lesson**: Language-level sandboxes are extraordinarily hard to get right. OS-level isolation is a necessary second (or primary) layer.

## Repl.it's Migration to Firecracker
Repl.it moved from Docker containers to AWS Firecracker microVMs. Firecracker provides KVM-based virtualization with <125ms startup times and strong isolation boundaries. This demonstrates the industry trend toward **stronger isolation** as platforms mature and attract more adversarial users.

## Google gVisor
gVisor intercepts application syscalls in userspace (the Sentry), reducing the kernel attack surface by 99%+. It is used in Google Cloud Run and App Engine. For a code runner, gVisor is an ideal production sandbox because even a kernel exploit inside the sandbox cannot reach the host kernel directly.

## runc Container Breakout — CVE-2019-5736
A vulnerability in `runc` (the Docker runtime) allowed a malicious container to overwrite the host `runc` binary via `/proc/self/exe`. When an admin later ran `docker exec`, the attacker code executed as root on the host. Patched, but it shows that the container runtime itself is a target.

## LeetCode Architecture (Public Conference Talks)
LeetCode uses a pool of pre-warmed Docker containers. Each submission is run inside a fresh container *process* (not a fresh container image pull) to reduce startup time to ~50ms. They use cgroup memory limits, CPU quotas, and seccomp profiles tuned per language.

## Lessons Applied Here
- Our Docker stub uses `--network none` to prevent egress.
- We stub capability dropping (`--cap-drop=ALL`).
- We stub read-only rootfs and tmpfs limits.
- The bug intentionally ignores output bounding to teach the OOM lesson.
