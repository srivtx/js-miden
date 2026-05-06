# 04-OLD-VS-NEW.md — Simple Redirector (M16)

## Old Patterns (2015–2020)

### 1. String Prefix Checks for URL Validation

**WHAT:** Using `startsWith('http')` or regex to validate URLs before redirecting.

```javascript
// 2015-era code (WRONG)
app.get('/redirect', (req, res) => {
  const url = req.query.url;
  if (url.startsWith('http')) {
    res.redirect(url);
  } else {
    res.status(400).send('Invalid URL');
  }
});
```

**WHY it was common:** Fast, no parser needed, seemed obvious.

**WRONG today:**
- `http://` (empty host) passes the check but is invalid.
- `http://javascript:alert(1)` passes the check (starts with `http`) but contains a JavaScript protocol in the auth/path area (bypassed in some old browsers).
- `http://evil.com?url=https://good.com` — the prefix check only looks at the start.
- Case variations: `HTTP://evil.com` might fail a lowercase check.

---

### 2. `301 Moved Permanently` for All Redirects

**WHAT:** Using `301` as the default redirect status for dynamic, user-supplied URLs.

```javascript
// 2016-era code (WRONG)
app.get('/redirect', (req, res) => {
  res.redirect(301, req.query.url); // Permanently cached!
});
```

**WHY it was common:** Developers confused "permanent" with "this is a real redirect." Many frameworks defaulted to 301 in early versions.

**WRONG today:**
- Browsers cache `301` indefinitely. If an attacker tricks the server into returning `301` to `evil.com`, that user's browser will forever redirect that URL to `evil.com` — even after the server is fixed.
- `301` changes POST to GET, breaking API flows.

---

### 3. Blacklist-Based Protocol Validation

**WHAT:** Rejecting known-bad protocols instead of allowing known-good ones.

```javascript
// 2017-era code (WRONG)
const BAD_PROTOCOLS = ['javascript:', 'data:', 'file:'];
if (BAD_PROTOCOLS.some(p => url.toLowerCase().startsWith(p))) {
  return res.status(400).send('Bad protocol');
}
res.redirect(url);
```

**WHY it was common:** Blacklists feel comprehensive when you write them.

**WRONG today:**
- New protocols emerge: `blob:`, `filesystem:`, `ftp:`, `vbscript:`, `about:`, `chrome:`. Each bypasses the blacklist.
- Encoding bypasses: `jAvAsCrIpT:alert(1)` with mixed case.
- Null byte injection: `javascript:\x00alert(1)` (in some old URL parsers).

---

## Modern Patterns (2020+)

### 1. Built-in URL Parser + Protocol Whitelist

**WHAT:** Using `new URL()` for parsing, then whitelisting only `http:` and `https:`.

```typescript
// 2025 code (RIGHT)
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
    if (!parsed.hostname) return false;
    return true;
  } catch {
    return false;
  }
}
```

**WHY it is right:**
- `new URL()` handles encoding, edge cases, and malformed input.
- Whitelist is future-proof: new protocols are rejected by default.
- Hostname check prevents `http://` (empty host).

---

### 2. `302 Found` for Dynamic Redirects

**WHAT:** Using `302` for user-supplied or computed redirect destinations.

```typescript
// 2025 code (RIGHT)
res.redirect(302, validatedUrl);
```

**WHY it is right:**
- Not cached by default. Safe for dynamic destinations.
- Widely understood by all HTTP clients.
- If a bug occurs, fixing the server immediately fixes the behavior (no stale browser caches).

---

### 3. Domain Whitelists for High-Security Flows

**WHAT:** Beyond protocol checks, validate that the hostname matches an allowlist.

```typescript
// 2025 code (RIGHT — production extension)
const ALLOWED_HOSTS = new Set(['example.com', 'sub.example.com']);

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname.toLowerCase());
}
```

**WHY it is right:**
- Protocol validation is the minimum. Domain validation is the standard for OAuth, payment flows, and sensitive redirects.
- Prevents open redirect to any `https:` domain, not just dangerous protocols.

---

## Comparison Table

| Era | Validation | Status Code | Protocol Check | Host Check |
|-----|-----------|-------------|----------------|------------|
| 2010 | None | 302 | None | None |
| 2015 | `startsWith('http')` | 301 | None | None |
| 2017 | Regex blacklist | 301/302 | Blacklist | None |
| 2020 | `new URL()` + whitelist | 302 | Whitelist (`http:`, `https:`) | Presence check |
| 2025 | `new URL()` + whitelist + domain allowlist | 302/307 | Whitelist | Exact domain match |

## WRONG vs RIGHT

| WRONG (Old) | RIGHT (Modern) |
|-------------|----------------|
| `url.startsWith('http')` | `new URL(url)` + protocol whitelist |
| `301` for dynamic redirects | `302` for dynamic, `308` only for permanent admin-configured |
| Blacklist dangerous protocols | Whitelist only `http:` and `https:` |
| No hostname validation | Check `hostname` is non-empty; domain allowlist in production |
| `res.redirect(url)` blindly | Validate, then `res.redirect(302, validatedUrl)` |

## SOURCES

- [RFC 7231 — HTTP/1.1 Semantics and Content](https://datatracker.ietf.org/doc/html/rfc7231)
- [RFC 7538 — HTTP Status Code 308](https://datatracker.ietf.org/doc/html/rfc7538)
- [OWASP Unvalidated Redirects Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
