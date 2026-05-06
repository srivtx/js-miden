# S12 URL Expander — Core Concepts

## HTTP Redirects

Redirects use 3xx status codes:
- **301 Moved Permanently**: Permanent redirect. Future requests should use the new URL.
- **302 Found**: Temporary redirect. Original URL remains valid.
- **307 Temporary Redirect**: Like 302, but method must not change (POST stays POST).
- **308 Permanent Redirect**: Like 301, but method must not change.

### Location Header
The `Location` header may be:
- **Absolute**: `https://example.com/path`
- **Relative**: `/path` or `../path`

Always resolve relative URLs against the current request URL:
```typescript
const nextUrl = new URL(response.headers.location, currentUrl).href;
```

## Redirect Loops

A loop occurs when the chain revisits a URL:
```
A → B → C → A (loop detected)
```

### Detection
Maintain a `Set` of visited URLs:
```typescript
if (chain.includes(nextUrl)) throw new Error('Redirect loop detected');
```

### Prevention
Also enforce a max redirect count (e.g., 10) to catch chains that grow linearly forever.

## SSRF via Redirects

Server-Side Request Forgery (SSRF) occurs when an attacker tricks the server into making requests to internal resources.

### The Attack
1. Attacker submits `https://attacker.com/start`.
2. Server validates: `attacker.com` is not blocked.
3. Server follows redirect to `http://localhost:8080/admin`.
4. Server returns internal admin page to attacker.

### Advanced Variants
- **DNS rebinding**: `attacker.com` initially resolves to `1.2.3.4` (passes validation), then TTL expires and resolves to `127.0.0.1` on follow.
- **Protocol downgrade**: `https://safe.com` redirects to `http://internal.com`.
- **IPv6 obfuscation**: `http://[::ffff:127.0.0.1]/` bypasses naive IPv4 blocklists.

### Fix: Validate Every Hop
```typescript
function validateRedirect(current: string, next: string): boolean {
  if (!isValidUrl(next)) return false;
  // Additional: resolve DNS and check IP
  return true;
}
```

## Timeout Handling

Without timeouts, a request to a black-holed IP can hang for minutes.

### Node.js http timeout
```typescript
const req = http.request(url, { timeout: 5000 }, (res) => { ... });
req.on('timeout', () => req.destroy());
```

### Total operation timeout
Wrap the entire expand operation:
```typescript
await Promise.race([
  expandUrl(url),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Total timeout')), 30000))
]);
```
