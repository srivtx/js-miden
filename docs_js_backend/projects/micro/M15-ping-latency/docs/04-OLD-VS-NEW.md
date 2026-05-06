# 04-OLD-VS-NEW.md — Ping API with Latency (M15)

## Old Patterns (2015–2020)

### 1. Shell Command Execution for "Ping"

**WHAT:** Using `child_process.exec()` or `execSync()` to run the system `ping` command.

```javascript
// 2015-era code (WRONG)
const { exec } = require('child_process');
app.get('/latency', (req, res) => {
  const target = req.query.target;
  exec(`ping -c 1 ${target}`, (err, stdout) => {
    if (err) return res.status(500).send(err);
    res.send(stdout); // Raw shell output to client
  });
});
```

**WHY it was common:** Developers knew the `ping` CLI tool and assumed wrapping it was the fastest path. Many Stack Overflow answers from 2015–2018 recommended this exact pattern.

**WRONG today:**
- **Command injection**: `target=google.com; cat /etc/passwd` executes arbitrary commands.
- **No SSRF protection**: `target=127.0.0.1` probes internal network.
- **Platform dependency**: `ping -c 1` works on Linux/macOS but not Windows (`ping -n 1`).
- **Raw output**: Shell stdout is unstructured and leaks system info (TTL, packet size, OS fingerprinting).

---

### 2. Hostname-Only SSRF Blocklists

**WHAT:** Checking only if the target string contains `localhost` or `127.0.0.1`.

```javascript
// 2016-era code (WRONG)
if (target.includes('localhost') || target.includes('127.0.0.1')) {
  return res.status(403).send('Blocked');
}
```

**WHY it was common:** Simple string checks feel sufficient.

**WRONG today:**
- Bypasses: `localHost` (case variation), `127.1` (short form), `0177.0.0.1` (octal), `0x7f.0.0.1` (hex).
- DNS rebinding: `evil.com` resolves to `127.0.0.1` after the check passes.
- IPv6 ignored entirely: `::1`, `0:0:0:0:0:0:0:1`.

---

### 3. `Date.now()` for Timing

**WHAT:** Using `Date.now()` (millisecond precision, system clock dependent) for latency measurement.

```javascript
// 2017-era code (WRONG)
const start = Date.now();
// ... network operation ...
const latency = Date.now() - start;
```

**WHY it was common:** `Date.now()` is the most obvious timer.

**WRONG today:**
- NTP adjustments can make `latency` negative.
- Millisecond precision is too coarse for fast LAN connections (<1ms).

---

## Modern Patterns (2020+)

### 1. Pure Node.js Networking APIs

**WHAT:** Using `dns.promises.lookup()` and `net.Socket.connect()` with `performance.now()`.

```typescript
// 2025 code (RIGHT)
const dnsStart = performance.now();
const { address } = await lookup(host);
const dnsTime = performance.now() - dnsStart;

const tcpStart = performance.now();
await new Promise((resolve, reject) => {
  const socket = new net.Socket();
  socket.setTimeout(5000);
  socket.connect(port, address, () => {
    socket.destroy();
    resolve();
  });
});
const tcpTime = performance.now() - tcpStart;
```

**WHY it is right:**
- No shell involved = no command injection.
- Cross-platform (works on Linux, macOS, Windows).
- Microsecond precision with monotonic clock.
- Structured JSON output instead of raw shell text.

---

### 2. Defense-in-Depth SSRF Protection

**WHAT:** Blocking hostnames AND resolved IPs against private ranges.

```typescript
// 2025 code (RIGHT)
function isBlockedHost(host: string): boolean { /* hostname checks */ }
function isBlockedIP(ip: string): boolean { /* CIDR regex checks */ }

if (isBlockedHost(host)) throw new Error('Blocked');
const { address } = await lookup(host);
if (isBlockedIP(address)) throw new Error('Blocked');
// Connect to validated IP directly
```

**WHY it is right:**
- Hostname blocklist catches obvious attacks before DNS.
- IP blocklist catches DNS rebinding and CNAME tricks.
- Connecting to the resolved IP prevents TOCTOU races.

---

### 3. `performance.now()` for High-Resolution Timing

**WHAT:** Using the Web-standard `performance.now()` API.

```typescript
// 2025 code (RIGHT)
const start = performance.now();
// ... operation ...
const elapsed = performance.now() - start; // microseconds
```

**WHY it is right:**
- Monotonic clock (never goes backward).
- Microsecond precision.
- Standard API across browsers and Node.js.

---

## Comparison Table

| Era | Timing | Networking | SSRF Defense | Output |
|-----|--------|-----------|--------------|--------|
| 2010 | `Date.now()` | `exec('ping')` | None | Raw shell text |
| 2015 | `Date.now()` | `exec('ping')` | Hostname string check | Raw shell text |
| 2020 | `process.hrtime()` | `net.Socket` | Hostname + IP check | JSON |
| 2025 | `performance.now()` | `dns` + `net.Socket` | Hostname + IP + cloud metadata | Structured JSON |

## WRONG vs RIGHT

| WRONG (Old) | RIGHT (Modern) |
|-------------|----------------|
| `child_process.exec('ping ' + target)` | `dns.promises.lookup()` + `net.Socket.connect()` |
| `Date.now()` for latency | `performance.now()` for latency |
| Hostname string check only | Hostname + resolved IP + IPv6 ranges |
| No timeout on network ops | 5-second socket timeout |
| Raw shell stdout to client | `{ host, ip, latencyMs }` JSON |

## SOURCES

- Node.js docs, `performance.now()` (introduced in Node.js 8.5+, stable by v12).
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- PortSwigger, "Command Injection," 2023.
