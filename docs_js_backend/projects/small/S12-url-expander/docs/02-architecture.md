# S12 URL Expander — Architecture

## Decision: Built-in http/https vs. fetch vs. Axios

### Alternative 1: Built-in http/https (Current)
- **Pros**: Zero dependencies, full control over redirects, timeouts, and headers.
- **Cons**: Verbose, callback-based API requires Promise wrapping.
- **Verdict**: Best for learning and when you need manual redirect control.

### Alternative 2: fetch (Node.js 18+)
- **Pros**: Standard API, Promise-native.
- **Cons**: `redirect: 'follow'` hides the chain; `redirect: 'manual'` requires manual `Location` parsing.
- **Verdict**: Good for simple use cases; less transparent for security auditing.

### Alternative 3: Axios
- **Pros**: Mature ecosystem, automatic JSON parsing, interceptors.
- **Cons**: Additional dependency, maxRedirects is a number but still follows blindly.
- **Verdict**: Great for general HTTP clients, but overkill for this focused tool.

## Decision: HEAD vs. GET for Redirect Following

### HEAD First (Current)
- **Pros**: Lighter; server does not need to render the full response body.
- **Cons**: Some servers return 405 Method Not Allowed or ignore HEAD entirely.
- **Verdict**: Correct default; fall back to GET on 405.

### GET Only
- **Pros**: Universally supported.
- **Cons**: May download large bodies unnecessarily (e.g., a 100 MB file behind a redirect).
- **Verdict**: Safer fallback, not ideal primary method.

## Decision: Synchronous vs. Async Validation of Redirects

### Current (Buggy)
Validate only the initial URL. Trust all subsequent redirects.
- **Pros**: Fast, simple.
- **Cons**: SSRF vulnerability; attackers bypass validation via redirects.

### Correct
Validate every `Location` header before following:
```typescript
if (!isValidUrl(nextUrl)) throw new Error('Blocked redirect target');
```
- **Pros**: Closes SSRF hole.
- **Cons**: Slightly more CPU per hop.
- **Verdict**: Non-negotiable for security.

## Decision: IP-Based Blocking Strategy

### Hostname Blocklist (Current)
Block `localhost`, `127.0.0.1`, `192.168.x.x`, `10.x.x.x`.
- **Pros**: Simple.
- **Cons**: Bypassable via DNS rebinding (`attacker.com` → `127.0.0.1`), IPv6 variations, or redirect chains.

### DNS Resolution + IP Blocklist
Resolve the hostname to an IP, then check if the IP is private.
- **Pros**: Catches DNS rebinding.
- **Cons**: Requires async DNS lookup per hop; may block on slow DNS.

### URL Fetching via Proxy
Force all outbound requests through a tightly controlled egress proxy.
- **Pros**: Centralized policy enforcement.
- **Cons**: Additional infrastructure complexity.
