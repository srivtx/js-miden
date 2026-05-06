# 02-DECISIONS.md — Ping API with Latency (M15)

## 1. Raw ICMP vs TCP Connect for Latency

### WHAT

| Method | Privilege Required | Accuracy | Data Sent |
|--------|-------------------|----------|-----------|
| **Raw ICMP ping** | Root / `CAP_NET_RAW` | Measures ICMP echo/reply | Minimal (no payload) |
| **TCP connect()** | Unprivileged | Measures SYN/SYN-ACK/ACK handshake | No application data |
| **HTTP HEAD request** | Unprivileged | Measures TLS + HTTP overhead | Full HTTP request/response |

### WHY

Raw ICMP is the "classic" ping. It sends an ICMP Echo Request and waits for an Echo Reply. However, many cloud environments (AWS Lambda, Google Cloud Run, Docker default seccomp) block raw ICMP sockets. Running a ping command requires either root privileges or Linux capabilities.

TCP connect is unprivileged. Any user process can open a TCP socket and measure the three-way handshake time. It is slightly different from ICMP (some networks prioritize ICMP or block it entirely), but for application-layer latency monitoring, TCP connect is more realistic — your app speaks HTTP/TCP anyway.

### DECISION

Use **TCP connect to port 80** (or user-specified port). This requires no privileges, works in all containerized environments, and measures the exact network path your HTTP requests would take.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `child_process.exec('ping -c 1 ' + target)` | `net.Socket.connect()` with `performance.now()` |
| Require root privileges for ICMP | Use unprivileged TCP connect |
| Measure HTTP response time (includes server processing) | Measure TCP handshake only (pure network latency) |

---

## 2. SSRF Defense Strategy

### WHAT

| Strategy | Mechanism | Strength | Weakness |
|----------|-----------|----------|----------|
| **Hostname blocklist** | Reject `localhost`, `127.0.0.1` by string | Fast, simple | DNS rebinding bypasses it |
| **IP range blocklist** | Reject resolved IPs in `10/8`, `172.16/12`, etc. | Reliable post-resolution | Requires resolving first |
| **Allowlist** | Only allow specific public domains | Most secure | Inflexible for general-purpose tools |
| **DNS firewall** | Network-level DNS filtering | Strong | Requires infrastructure |

### WHY

A hostname blocklist alone is insufficient. An attacker can register `evil.com` with a DNS record pointing to `127.0.0.1`. The hostname check passes, but the connection hits localhost.

An IP range blocklist after resolution is necessary but not sufficient alone. If you only check IPs, an attacker could use `localhost` which never resolves through DNS.

### DECISION

**Defense in depth:**
1. Block dangerous hostnames (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`) before DNS.
2. Resolve DNS explicitly with `dns.promises.lookup()`.
3. Validate the resolved IP against private IPv4 and IPv6 ranges.
4. Connect directly to the validated IP — never re-resolve the hostname.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Only hostname blocklist | Hostname blocklist + resolved IP blocklist |
| Connect by hostname after DNS | Connect by resolved IP to prevent rebinding |
| Block only IPv4 private ranges | Block IPv4 (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`) AND IPv6 (`fc00::/7`, `fe80::/10`) |
| No cloud metadata protection | Explicitly block `169.254.169.254` and link-local range |

---

## 3. Timing API Choice

### WHAT

| API | Resolution | Monotonic | Use Case |
|-----|-----------|-----------|----------|
| `Date.now()` | ~1 ms | No (affected by NTP) | Rough timestamps |
| `process.hrtime()` | Nanoseconds | Yes | Deprecated in Node.js |
| `process.hrtime.bigint()` | Nanoseconds | Yes | High-res intervals |
| `performance.now()` | Microseconds | Yes | Web-standard, high-res timing |

### WHY

`Date.now()` is affected by system clock adjustments (NTP, leap seconds). If the clock jumps backward during measurement, you get negative latency — nonsense.

`performance.now()` uses a monotonic clock that only moves forward, independent of system time changes. It is the web standard and available in both browsers and Node.js.

### DECISION

Use **`performance.now()`** for all latency measurements. It provides microsecond precision, is monotonic, and is the standard API for performance measurement.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `Date.now()` for latency | `performance.now()` for latency |
| `console.time()` / `console.timeEnd()` | `performance.now()` with explicit math |
| No measurement of DNS vs TCP separately | Measure DNS and TCP independently for observability |

## SOURCES

- Node.js docs, `dns.promises`, `net.Socket`, `performance`.
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- PortSwigger, "DNS Rebinding," 2023.
