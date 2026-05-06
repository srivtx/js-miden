# 01-THINKING.md — Ping API with Latency (M15)

## Mental Model: The Network Stethoscope

Imagine a doctor's stethoscope placed against the chest of the internet. Each "beat" is a TCP handshake. The latency endpoint listens to that beat and reports how long it took to travel from your server to the target and back.

But this stethoscope is dangerous in the wrong hands. If you let anyone point it at internal organs (localhost, private IPs, cloud metadata), they can map your internal anatomy and find weak spots to exploit.

## The Hot Path

Every request to `GET /latency?target=google.com` triggers this sequence:

```
1. Extract target hostname from query parameter
2. Strip port if present → host = "google.com"
3. Check host against blocked hostnames (localhost, 127.0.0.1, ::1)
4. Resolve DNS: dns.promises.lookup("google.com")
5. Check resolved IP against blocked ranges (10.x, 172.16.x, 192.168.x, etc.)
6. Create net.Socket
7. Set 5-second timeout
8. socket.connect(port, resolvedIP)
9. On connect → clear timeout, destroy socket, measure elapsed time
10. Return { host, ip, latencyMs }
```

**The hot path performs network I/O.** DNS resolution is typically 1-300ms. TCP handshake is typically 5-100ms. Both are blocking operations from the event loop's perspective, so `performance.now()` before and after each step gives accurate elapsed wall-clock time.

## Danger Zones

### 1. SSRF via DNS Rebinding
An attacker controls a domain whose DNS TTL is very short. The first resolution returns a public IP (passes validation), but a second resolution (performed by the actual TCP connect) returns `127.0.0.1`.

**Mitigation:** Resolve once, then connect to the resolved IP directly. Do not let the TCP stack re-resolve the hostname.

### 2. Time-of-Check to Time-of-Use (TOCTOU)
The code validates the hostname, resolves DNS, validates the IP, then connects. If DNS is attacker-controlled, the IP could change between validation and connection.

**Mitigation:** Connect directly to the already-resolved IP (as this implementation does). Never pass the original hostname to `net.connect()` after resolution.

### 3. IPv6 Ambiguity
`::1` is localhost. `fe80::/10` is link-local. `fc00::/7` is private. Many developers forget IPv6 entirely and only block `127.0.0.1`.

**Mitigation:** Block both IPv4 and IPv6 private ranges explicitly.

### 4. Command Injection via Shell Execution
The most catastrophic mistake is using `child_process.exec()` or `execSync()` with user input:

```javascript
exec(`ping -c 1 ${target}`)  // DANGER
```

An attacker sends `target=google.com; curl http://169.254.169.254/latest/meta-data/`. The shell executes both commands.

**Mitigation:** Never pass user input to any shell command. Use Node.js built-in networking APIs (`dns`, `net`) instead.

### 5. Cloud Metadata Services
AWS, GCP, Azure, and DigitalOcean expose instance metadata at `169.254.169.254`. An SSRF vulnerability here can leak IAM credentials, SSH keys, and internal network configs.

**Mitigation:** Block `169.254.0.0/16` (link-local) explicitly.

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Use `child_process.exec()` for ping | Use `dns.promises.lookup()` + `net.Socket.connect()` |
| Block only `localhost` by string match | Block hostnames AND resolved IPs against private ranges |
| Only check IPv4 private ranges | Check IPv4 (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`) AND IPv6 (`fc00::/7`, `fe80::/10`) |
| Connect by hostname after DNS lookup | Connect by resolved IP to prevent DNS rebinding |
| No timeout on socket | Set 5-second timeout to prevent event loop blocking |
| Return raw shell stdout to client | Return structured JSON with measured latency |
| Allow cloud metadata IPs | Block `169.254.169.254` and entire link-local range |

## Key Insight

> **SSRF protection is not a regex problem; it is a network-layer problem.**
>
> Hostname blocklists fail because DNS is dynamic. The only reliable defense is to resolve the hostname yourself, validate the resulting IP against private ranges, and then connect directly to that IP — never letting the OS re-resolve the name.

## SOURCES

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- PortSwigger, "Server-Side Request Forgery (SSRF)," 2023.
- Node.js docs, `dns.promises` and `net.Socket`.
