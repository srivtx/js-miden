# M15: Ping API with Latency

## Phase 1: Basic Functionality

- **GET /ping** — Returns `pong` with the current server ISO timestamp.
- **GET /latency?target=google.com** — Measures DNS resolution + TCP handshake latency to an external host. Blocks internal/private IPs.

## Phase 2: Technical Thinking

### DNS Resolution Time

- DNS lookup is the first step in any outbound connection.
- Cached DNS lookups are fast (~1-5ms); uncached lookups can take 50-300ms.
- We use `dns.promises.lookup()` to measure this explicitly.

### TCP Handshake

- TCP 3-way handshake (SYN → SYN-ACK → ACK) establishes the connection.
- Measuring TCP connection time gives a good proxy for network latency.
- We connect to port 80 (HTTP) and immediately close — no data is sent.

### Measuring Accurately

- Use `performance.now()` for high-resolution timing (microsecond precision).
- Separate DNS time from TCP time for better observability.
- Set a timeout (5s) to prevent hanging on unreachable hosts.

### Preventing Abuse (SSRF Protection)

- **Block internal hostnames**: `localhost`, `127.0.0.1`, `::1`
- **Block private IP ranges**:
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
  - `127.0.0.0/8`
  - `169.254.0.0/16` (link-local)
  - `fc00::/7` (IPv6 private)
  - `fe80::/10` (IPv6 link-local)
- **Block cloud metadata IPs**: `169.254.169.254` (AWS, GCP, Azure metadata services)
- Validate the resolved IP *after* DNS, not just the hostname.

## Phase 3: Design Decisions

- **No raw ICMP**: ICMP requires root privileges. TCP connect is unprivileged and sufficient for latency measurement.
- **No `child_process.exec`**: Never pass user input to shell commands — command injection risk.
- **Defense in depth**: Block both hostnames and resolved IPs.

## Bug

See `bug/bug.ts`:
- No SSRF protection — allows pinging `localhost`, `127.0.0.1`, `192.168.x.x`, `10.x.x.x`, and cloud metadata IPs.
- Uses `child_process.exec()` with unsanitized user input → **command injection** vulnerability.

## Running

```bash
npm install
npm run dev     # Start server
npm test        # Run tests
```
