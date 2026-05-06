# M15 Ping API — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```
GET /latency?target=localhost          → probes internal service
GET /latency?target=127.0.0.1          → probes loopback
GET /latency?target=192.168.1.1        → probes private LAN
GET /latency?target=10.0.0.1           → probes VPC
GET /latency?target=                   → crashes DNS lookup
GET /latency                           → measureLatency(undefined) → crash
```

An attacker registers `evil.com` with DNS A record `127.0.0.1`. Your naive check `if (target.includes('localhost'))` never sees it because the string is `evil.com`. Only AFTER DNS resolution do you know the real IP.

## The Fix: Validate Before AND After DNS

```ts
const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]',
]);

const BLOCKED_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
];

function isBlockedIP(ip: string): boolean {
  if (BLOCKED_HOSTS.has(ip)) return true;
  return BLOCKED_RANGES.some((range) => range.test(ip));
}

function isBlockedHost(host: string): boolean {
  return BLOCKED_HOSTS.has(host.toLowerCase());
}

export async function measureLatency(target: string) {
  const host = target.split(':')[0];

  // BLOCK 1: Reject known bad hosts before DNS
  if (isBlockedHost(host)) {
    throw new Error('Access to internal hosts is blocked');
  }

  // BLOCK 2: Resolve DNS, then check the resolved IP
  const addresses = await lookup(host);
  const ip = addresses.address;

  if (isBlockedIP(ip)) {
    throw new Error('Access to internal IPs is blocked');
  }

  // ... continue with TCP connection
}
```

**Why two blocks?**
- Pre-DNS: catches obvious attempts (`localhost`, `127.0.0.1`)
- Post-DNS: catches DNS rebinding attacks where `evil.com` → `127.0.0.1`

## The Pain That Remains

You deploy to production. A user reports `/latency?target=example.com` hangs forever. You have no idea why. No logs. No visibility. The TCP connection is timing out after... wait, we never set a timeout.

## What v4 Fixes

Logging. Production without logs is flying blind.
