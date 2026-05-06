# X-Forwarded-For

## WHAT

`X-Forwarded-For` (XFF) is a de-facto standard request header that identifies the originating client IP and proxy hops through which a request passes.

Format: comma-separated list, leftmost = original client, rightmost = last proxy.

```
X-Forwarded-For: 203.0.113.195, 70.41.3.18, 150.172.238.178
```

## WHY

In cloud architectures, the TCP `remoteAddress` is the load balancer or reverse proxy, not the end user. XFF restores visibility but introduces a trust problem: **the client can set arbitrary values before reaching your infrastructure.**

## HOW

**Parsing:**

```javascript
function parseXFF(header) {
  if (!header) return [];
  return header.split(",").map(s => s.trim()).filter(Boolean);
}
```

**Selecting the client IP:**

If you have N trusted proxies (e.g., Cloudflare → ALB → App), discard the leftmost N entries and take the next one.

```javascript
const TRUSTED_PROXY_COUNT = 2; // e.g., Cloudflare + AWS ALB
const ips = parseXFF(req.headers["x-forwarded-for"]);
// Take the rightmost untrusted IP
const clientIp = ips[ips.length - 1 - TRUSTED_PROXY_COUNT];
```

**Validation:**

- Reject private/reserved IPs if you expect public clients.
- Use an IP parsing library (`ipaddr.js`) to avoid string manipulation bugs.

## WRONG vs RIGHT

### WRONG: Trust the First IP

```javascript
// BAD: Attacker can inject any IP
const ip = req.headers["x-forwarded-for"]?.split(",")[0];
// Attacker sends: X-Forwarded-For: 1.2.3.4
// Your app trusts 1.2.3.4 as the real client
```

### RIGHT: Trust the Rightmost Untrusted IP

```javascript
// GOOD: Configurable trust proxy count
const ipaddr = require("ipaddr.js");

function getClientIp(req, trustCount) {
  const forwarded = req.headers["x-forwarded-for"];
  if (!forwarded) return req.socket.remoteAddress;
  const ips = forwarded.split(",").map(s => s.trim()).reverse();
  // Skip trusted proxies from the right
  const candidate = ips[trustCount];
  if (candidate && ipaddr.isValid(candidate)) {
    return candidate;
  }
  return req.socket.remoteAddress;
}
```

## Breach Story: Shopify IP Allowlist Bypass (2018)

During a 2018 bug bounty program, researchers discovered that Shopify's internal admin panel relied on `X-Forwarded-For` for IP-based access control without validating the number of trusted proxies. By sending `X-Forwarded-For: 127.0.0.1`, attackers bypassed the allowlist and accessed sensitive endpoints. Shopify awarded a bounty and fixed the issue by validating proxy chains at the edge.

## References

- OWASP: X-Forwarded-For Header Manipulation — https://owasp.org/www-project-web-security-testing-guide/
- RFC 7239 — Forwarded HTTP Extension (standardized alternative to XFF)
- MDN: X-Forwarded-For — https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
