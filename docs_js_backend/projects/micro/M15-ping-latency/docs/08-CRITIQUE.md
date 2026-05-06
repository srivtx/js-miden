# 08-CRITIQUE.md — Ping API with Latency (M15)

## Senior Engineer Review

### Overall Assessment

This is a **clean, focused teaching project** that demonstrates network latency measurement while embedding two critical security concepts: SSRF protection and command injection prevention. The code is minimal, well-structured, and the separation of `latency.ts` from `app.ts` is good architecture.

### Strengths

1. **Defense in Depth for SSRF**
   ```typescript
   if (isBlockedHost(host)) throw new Error("...");
   const { address } = await lookup(host);
   if (isBlockedIP(address)) throw new Error("...");
   ```
   Blocking hostnames before DNS and IPs after DNS is the correct pattern. It catches obvious attacks early and rebinding attacks after resolution.

2. **No Shell Execution**
   The project explicitly avoids `child_process.exec()` and uses `dns.promises.lookup()` + `net.Socket.connect()`. This eliminates command injection entirely.

3. **High-Resolution Timing**
   Using `performance.now()` instead of `Date.now()` shows awareness of monotonic clocks and microsecond precision.

4. **Socket Timeout**
   ```typescript
   const timeout = setTimeout(() => {
     socket.destroy();
     reject(new Error("Connection timeout"));
   }, 5000);
   ```
   This prevents the event loop from hanging on unreachable hosts.

### Weaknesses

1. **Regex-Based IP Validation is Fragile**
   ```typescript
   const BLOCKED_RANGES = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, ...];
   ```
   Regexes work for IPv4 but are hard to maintain. For IPv6, they are incomplete. A better approach is to use a CIDR library (e.g., `ip-address`) or Node.js built-in `net.BlockList` (Node.js 15+):
   ```typescript
   const blocklist = new net.BlockList();
   blocklist.addSubnet("10.0.0.0", 8);
   blocklist.addSubnet("172.16.0.0", 12);
   // ... then check blocklist.check(ip)
   ```

2. **No IPv6 Literal Validation for Scoped Addresses**
   IPv6 scoped addresses like `fe80::1%eth0` are not handled. The `%eth0` suffix would fail the regex but might still be parsed by `net.Socket.connect()` on some systems.

3. **DNS Rebinding TOCTOU Risk**
   While the code resolves once and connects to the IP, the `net.Socket.connect(port, ip)` call in Node.js may still perform a reverse lookup in some edge cases. Using `socket.connect({ port, host: ip, lookup: () => ip })` ensures no second lookup occurs.

4. **No Rate Limiting on /latency**
   An attacker can hammer `/latency` to use your server as a DDoS amplifier or to scan thousands of IPs. A rate limiter (see M05) should be applied.

5. **Error Messages Leak Information**
   ```typescript
   res.status(403).json({ error: message });
   ```
   If `lookup()` throws `ENOENT` for a non-existent domain, the error message reveals whether the domain exists. Use generic error messages:
   ```typescript
   res.status(403).json({ error: "Access denied or host unreachable" });
   ```

### Code Smells

| Smell | Location | Severity |
|-------|----------|----------|
| Regex for CIDR | `latency.ts` | Medium — works but fragile |
| `target.split(":")[0]` for host stripping | `latency.ts` | Low — IPv6 literals with ports break this |
| Generic 403 for all errors | `app.ts` | Low — acceptable for micro project |
| No rate limiting | `app.ts` | Medium — production requirement |

### What Would Make This Production-Grade

1. **CIDR library or `net.BlockList`** for robust IP validation.
2. **Rate limiting** on `/latency` (e.g., 10 requests/minute per IP).
3. **Structured logging** (Pino/Winston) with request IDs.
4. **Metrics:** Prometheus counters for `latency_requests_total`, `latency_blocked_total`.
5. **Async DNS cache** to avoid repeated lookups for the same host.
6. **IPv6 literal parsing** that handles `[::1]:8080` format correctly.

### Final Verdict

> **A as a teaching project. C+ as production code.**
>
> The security fundamentals are correct. To deploy this to production, add rate limiting, use a CIDR library for IP validation, and tighten error messages.

## WRONG vs RIGHT

| Wrong (Current) | Right (Production) |
|-----------------|--------------------|
| Regex-based IP blocking | `net.BlockList` or CIDR library |
| No rate limiting | Rate limiter middleware (M05) |
| Detailed error messages | Generic errors to prevent info leakage |
| `target.split(":")[0]` | Proper URL/host parsing for IPv6 literals |
| No metrics | Prometheus / Datadog integration |

## SOURCES

- Node.js docs, `net.BlockList` (added in v15.0.0).
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Author's own review based on 10+ years of building network tools.
