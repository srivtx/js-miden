# M19 Header Inspector — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Your TypeScript inspector still trusts headers blindly:

```bash
# IP spoofing
curl http://your-api.com/ip -H "X-Forwarded-For: 1.2.3.4"
# → { "ip": "1.2.3.4", "trusted": true } — WRONG

# Invalid IP format
curl http://your-api.com/ip -H "X-Forwarded-For: not-an-ip"
# → { "ip": "not-an-ip", "trusted": true } — WRONG

# Empty XFF chain
curl http://your-api.com/ip -H "X-Forwarded-For: , ,"
# → { "ip": "", "trusted": true } — WRONG
```

The fundamental issue: `X-Forwarded-For` is a **client-controlled header** unless your app is behind a trusted proxy that sanitizes it. If a request bypasses your CDN/load balancer, the attacker controls the entire header value.

## The Fix: Proxy-Aware Validation

```ts
const TRUSTED_PROXIES = (process.env.TRUSTED_PROXIES || '127.0.0.1').split(',');

function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXIES.includes(ip);
}

function isValidIP(ip: string): boolean {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4.test(ip) || ipv6.test(ip) || ip === '::1';
}

export function extractClientIp(req: Request) {
  const remoteAddress = req.socket.remoteAddress || 'unknown';

  // If direct connection is NOT a trusted proxy, ignore X-Forwarded-For entirely
  if (!isTrustedProxy(remoteAddress)) {
    return { ip: remoteAddress, source: 'direct', trusted: true };
  }

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const ips = xff.split(',').map(ip => ip.trim()).filter(isValidIP);
    if (ips.length > 0) {
      // In a chain: client, proxy1, proxy2
      // If we trust proxy2 (our direct connection), real client is leftmost untrusted
      return { ip: ips[0], source: 'x-forwarded-for', trusted: true };
    }
  }

  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && isValidIP(xri)) {
    return { ip: xri, source: 'x-real-ip', trusted: true };
  }

  return { ip: remoteAddress, source: 'direct', trusted: true };
}
```

**What validation prevents:**
- **Spoofing from untrusted sources:** If `remoteAddress` isn't your load balancer, `X-Forwarded-For` is ignored
- **Invalid IPs:** `not-an-ip` is filtered out
- **Empty chains:** `,,` produces no valid IPs, falls back to direct IP

## The Pain That Remains

You deploy. A security scan reports missing security headers on your API responses. You check... your `/security` endpoint analyzes **request** headers, but your app doesn't set **response** headers. There's no logging of header analysis attempts.

## What v4 Fixes

Logging. See who's probing your headers.
