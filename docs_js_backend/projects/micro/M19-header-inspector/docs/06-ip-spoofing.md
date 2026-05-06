# IP Spoofing

## WHAT

**IP spoofing** is the act of sending network packets with a forged source IP address. In HTTP applications, it commonly manifests as:

- Injecting fake `X-Forwarded-For` values.
- Sending requests through open proxies to mask the origin.
- Exploiting UDP-based protocols (DNS, NTP, Memcached) for amplification attacks.

This document focuses on HTTP-layer spoofing via headers.

## WHY

Applications frequently use IP addresses for:

- **Rate limiting:** Preventing brute-force attacks.
- **Geo-blocking:** Enforcing content licensing.
- **Admin allowlists:** Restricting sensitive endpoints.
- **Audit logging:** Tracking user activity.

If an attacker can spoof their IP, they bypass all these controls.

## HOW

**Defense strategy:**

1. **Strip untrusted headers at the edge.** Your CDN or load balancer should remove `X-Forwarded-*` from the client and append its own.
2. **Configure trust proxy count.** In Express: `app.set("trust proxy", 2)`.
3. **Validate IP format.** Use `ipaddr.js` to prevent string injection (`X-Forwarded-For: <script>alert(1)</script>`).
4. **Never use IP alone for critical decisions.** Combine with authentication, MFA, and behavioral signals.

```javascript
const ipaddr = require("ipaddr.js");

function getClientIp(req, trustedProxyCount) {
  const forwarded = req.headers["x-forwarded-for"];
  if (!forwarded) return req.socket.remoteAddress;

  const ips = forwarded.split(",").map(s => s.trim());
  const candidate = ips[ips.length - 1 - trustedProxyCount];

  if (!candidate || !ipaddr.isValid(candidate)) {
    return req.socket.remoteAddress;
  }
  return candidate;
}
```

## WRONG vs RIGHT

### WRONG: Trust First XFF IP

```javascript
// BAD: Attacker controls leftmost value
const ip = req.headers["x-forwarded-for"]?.split(",")[0];
// Attacker sends: X-Forwarded-For: 1.2.3.4
// Bypasses rate limit for 1.2.3.4
```

### RIGHT: Trust Rightmost Untrusted IP

```javascript
// GOOD: Validate chain length against known proxy hops
app.set("trust proxy", 2); // Cloudflare + ALB

// Express now safely resolves req.ip
app.use((req, res, next) => {
  console.log("Client IP:", req.ip);
  next();
});
```

## Breach Story: Shopify Admin Panel Bypass (2018)

Bug bounty researchers discovered that Shopify's internal admin endpoints used `X-Forwarded-For` for IP allowlisting without validating the proxy chain. By sending `X-Forwarded-For: 127.0.0.1`, attackers bypassed the allowlist and accessed internal tools. Shopify awarded a $20,000 bounty and implemented proxy-chain validation.

## References

- OWASP: Testing for IP Address Spoofing — https://owasp.org/www-project-web-security-testing-guide/
- RFC 7239 — Forwarded HTTP Extension
- RFC 1918 — Address Allocation for Private Internets
- Cloudflare: True-Client-IP Header — https://developers.cloudflare.com/fundamentals/reference/http-request-headers/
