# 00-PROBLEM.md — Ping API with Latency (M15)

## WHAT

Build an HTTP API that:

1. **GET /ping** — Returns `pong` with the current server ISO timestamp.
2. **GET /latency?target=google.com** — Measures DNS resolution + TCP handshake latency to an external host.
3. **Blocks internal/private IPs** to prevent Server-Side Request Forgery (SSRF).
4. **Never uses shell commands** with user input to prevent command injection.
5. **Returns accurate timing** using high-resolution timers, separating DNS time from TCP time.

The latency endpoint must resolve the hostname, validate the resolved IP against private ranges, perform a TCP `connect()` to port 80, measure elapsed time, and return `{ host, ip, latencyMs }`.

## WHY

Network latency measurement is foundational for:

- **Monitoring & observability**: SRE teams measure endpoint health from multiple vantage points.
- **CDN selection**: Choosing the fastest origin server among replicas.
- **Performance baselines**: Detecting when a downstream dependency slows down.
- **Security scanning**: Verifying that an API cannot be abused to probe internal infrastructure.

Without SSRF protection, a latency endpoint becomes a **free port scanner** for an attacker to map internal services, access cloud metadata endpoints (AWS, GCP, Azure), and pivot deeper into a network.

Without command-injection protection, a latency endpoint becomes a **remote shell** where `target=google.com; cat /etc/passwd` executes arbitrary system commands.

## CONSTRAINTS

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Protocol | TCP connect to port 80 | Unprivileged; no raw ICMP (requires root) |
| Timeout | 5000 ms | Prevent hanging on unreachable hosts |
| Timer | `performance.now()` | Microsecond precision, monotonic clock |
| DNS | `dns.promises.lookup()` | Explicit measurement of resolution time |
| SSRF blocklist | Private ranges + cloud metadata | Defense in depth |
| No shell execution | Prohibit `child_process.exec` | Eliminate command injection vector |

## SCOPE

### In Scope
- Express routes for `/ping` and `/latency`.
- DNS resolution timing.
- TCP connection timing (SYN → SYN-ACK → ACK).
- IP-based SSRF blocklist (hostnames and resolved IPs).
- Boundary tests for SSRF bypasses.

### Out of Scope
- ICMP ping (requires root/capabilities).
- Continuous monitoring / polling loops.
- Geographic distributed vantage points.
- TLS handshake timing (would require TLS negotiation).
- WebSocket latency.

## ACCEPTANCE CRITERIA

1. `GET /ping` returns `200` with `{ message: "pong", timestamp: <ISO> }`.
2. `GET /latency?target=google.com` returns `200` with `host`, `ip`, and `latencyMs`.
3. `GET /latency?target=localhost` returns `403` with error mentioning "blocked".
4. `GET /latency?target=127.0.0.1` returns `403`.
5. `GET /latency?target=192.168.1.1` returns `403`.
6. `GET /latency?target=10.0.0.1` returns `403`.
7. `GET /latency?target=169.254.169.254` returns `403` (cloud metadata).
8. Requests to unreachable hosts time out after 5s with a clear error.

## SOURCES

- [RFC 791 — Internet Protocol](https://datatracker.ietf.org/doc/html/rfc791)
- [RFC 1918 — Address Allocation for Private Internets](https://datatracker.ietf.org/doc/html/rfc1918)
- [RFC 4291 — IP Version 6 Addressing Architecture](https://datatracker.ietf.org/doc/html/rfc4291)
- [OWASP SSRF Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Node.js docs, `dns.promises.lookup()` and `net.Socket`.
