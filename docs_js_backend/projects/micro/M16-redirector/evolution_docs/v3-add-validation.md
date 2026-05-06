# M16 Redirector — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Your TypeScript redirector accepts any string `url`. An attacker probes:

```bash
# XSS via javascript: scheme
curl -X POST http://localhost:3000/redirect \
  -d '{"url":"javascript:alert(\\'xss\\')"}'

# Data URI injection
curl -X POST http://localhost:3000/redirect \
  -d '{"url":"data:text/html,<script>alert(1)</script>"}'

# File system access
curl -X POST http://localhost:3000/redirect \
  -d '{"url":"file:///etc/passwd"}'

# Missing URL entirely
curl -X POST http://localhost:3000/redirect \
  -d '{}'
```

Without validation, every one of these gets a 302 redirect. Your domain becomes an XSS vector, a phishing proxy, and a filesystem explorer.

## The Fix: Strict URL Validation

```ts
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Reject non-http(s) protocols
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return false;
    }

    // Reject empty host
    if (!parsed.hostname) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
```

**Why `new URL()`?**
- It parses strictly. `not-a-url` throws.
- It exposes the protocol. `javascript:` is not `http:`.
- It exposes the hostname. Empty host = invalid.

**What we block:**
- `javascript:` — XSS vector
- `data:` — data URI injection
- `file:` — local file access
- `ftp:`, `mailto:`, `tel:` — unexpected behavior
- Empty strings and malformed URLs — caught by `try/catch`

## The Pain That Remains

You deploy. A security researcher reports your `/redirect` endpoint is being used in phishing campaigns. You check your application logs... you don't have any. You have no idea who is using it, how often, or what URLs are being requested.

## What v4 Fixes

Logging. Without it, you're defending in the dark.
