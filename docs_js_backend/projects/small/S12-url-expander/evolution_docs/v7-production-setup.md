# v7 — Production Setup

Your URL expander works. It follows redirects, detects loops, blocks SSRF, has timeouts, validation, logs, and tests. But production URL expansion has unique dangers.

## Pain #1: SSRF is Still Possible

You validate IPs against `10.x` and `192.168.x`. But you forgot:
- `127.0.0.1` → localhost
- `169.254.169.254` → AWS metadata service (can leak IAM credentials)
- `0.0.0.0` → all interfaces
- IPv6 variants like `[::1]`

**Fix:** Comprehensive SSRF protection.

```ts
const BLOCKED_HOSTS = new Set([
  'localhost', '0.0.0.0', '[::1]', '[::]',
]);

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostname)) return false;

    // Block private IPv4 ranges
    const ip = hostname;
    if (/^127\./.test(ip)) return false;
    if (/^10\./.test(ip)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return false;
    if (/^192\.168\./.test(ip)) return false;
    if (/^169\.254\./.test(ip)) return false; // Link-local

    // Block IPv6 loopback and link-local
    if (ip === '::1') return false;
    if (ip.startsWith('fe80:')) return false;

    return true;
  } catch {
    return false;
  }
}
```

And validate **every redirect target**, not just the initial URL.

## Pain #2: No Request Limits

A user sends a URL chain of 50 redirects. Your code follows all of them. It takes 50 × 5 seconds = 250 seconds. The connection hangs.

**Fix:** Strict limits.

```ts
const MAX_REDIRECTS = 10;
const TIMEOUT_MS = 5000;
const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB
```

## Pain #3: DNS Rebinding

An attacker controls a domain that resolves to a public IP at validation time, then switches to `127.0.0.1` at request time.

**Fix:** Resolve DNS at validation time and cache the IP. Or use a library that validates after DNS resolution.

```ts
import dns from 'node:dns';

const addresses = await dns.promises.resolve(hostname);
for (const addr of addresses) {
  if (isPrivateIp(addr)) return false;
}
```

## Pain #4: Environment Config

You hardcoded `MAX_REDIRECTS = 10` and `TIMEOUT = 5000`. Production might need stricter limits.

**Fix:** Env vars.

```ts
const MAX_REDIRECTS = parseInt(process.env.MAX_REDIRECTS || '10');
const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT || '5000');
const MAX_CHAIN_LENGTH = parseInt(process.env.MAX_CHAIN_LENGTH || '10');
```

## Pain #5: Process Crashes

An unhandled error in the HTTP request kills the server.

**Fix:** Error boundaries and graceful shutdown.

```ts
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
```

## Final Checklist

- [ ] SSRF protection on every hop (initial + redirects)
- [ ] Block all private IP ranges (IPv4 and IPv6)
- [ ] Block metadata endpoints (169.254.169.254)
- [ ] Redirect loop detection
- [ ] Max redirect limit (e.g., 10)
- [ ] Request timeout per hop
- [ ] DNS resolution validation
- [ ] Environment-based config
- [ ] Graceful shutdown
- [ ] Health check endpoint

This is a production URL expander. It started as a naive `https.get()`. Now it safely follows redirects while protecting your internal network from SSRF attacks.
