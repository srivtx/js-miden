# 02-DECISIONS.md — Simple Redirector (M16)

## 1. Redirect Status Code Selection

### WHAT

| Status | Semantics | Method Preservation | Cache Behavior |
|--------|-----------|---------------------|----------------|
| **301 Moved Permanently** | Resource moved forever | No (may change POST to GET) | Permanently cached by browsers |
| **302 Found** | Resource moved temporarily | No (may change POST to GET) | Not cached by default |
| **307 Temporary Redirect** | Resource moved temporarily | Yes (POST stays POST) | Not cached by default |
| **308 Permanent Redirect** | Resource moved forever | Yes (POST stays POST) | Permanently cached by browsers |

### WHY

- **301** is dangerous for dynamic redirects. If an attacker tricks the server into returning `301` to `evil.com`, every browser that visited that redirect will cache it indefinitely. Even after the server is fixed, users still go to `evil.com`.
- **302** is the safe default for dynamic, user-supplied redirects. It tells the browser: "Go here for now, but ask me again next time."
- **307** is ideal for API flows where method preservation matters (e.g., POSTing a form and being redirected to a payment processor that also expects POST).
- **308** is the "fixed 301" — safe for permanent redirects where you want method preservation (e.g., HTTP → HTTPS upgrade for POST endpoints).

### DECISION

Use **302 Found** as the default for this redirector. The URLs are user-supplied and dynamic. Caching would be a security risk. Method preservation is not required for this use case.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `301` for dynamic redirects | `302` for dynamic, user-supplied redirects |
| `res.redirect(url)` (defaults to 302 in Express, but explicit is better) | `res.redirect(302, url)` for clarity |
| `308` without understanding cache implications | `308` only for admin-configured permanent redirects |

---

## 2. URL Validation Strategy

### WHAT

| Strategy | Mechanism | Pros | Cons |
|----------|-----------|------|------|
| **String prefix check** | `url.startsWith('http')` | Fast | `http://` passes; `http://` with empty host or `http://javascript:alert(1)` can trick naive checks |
| **Regex validation** | Custom regex for URLs | Flexible | Easy to get wrong; bypasses common |
| **Built-in URL parser** | `new URL(url)` | Standard, robust, handles encoding | Throws on malformed input; must still check protocol |
| **Library (validator.js)** | `isURL()` from `validator` | Comprehensive | Extra dependency; may be overkill |

### WHY

`new URL(url)` is the built-in, well-tested parser. It handles percent-encoding, IDN, ports, paths, and query strings. It throws a clear error on malformed input. Once parsed, we can inspect `protocol`, `hostname`, and `port` with confidence.

A regex like `/^https?:\/\/.+/` looks safe but misses `https://` (empty host) or `https://evil.com\@trusted.com` (auth section abuse, though modern browsers handle this correctly).

### DECISION

Use **`new URL(url)`** for parsing, then whitelist `protocol` to `http:` and `https:`, and ensure `hostname` is non-empty. No regex. No library.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `url.startsWith('http')` | `new URL(url)` + protocol whitelist |
| Custom regex for URL validation | Built-in parser + explicit protocol check |
| Only check protocol, ignore empty hostname | Check both protocol and hostname presence |
| Allow relative URLs (`/path`) for redirects | Reject relative URLs unless explicitly intended |

---

## 3. Protocol Whitelist vs Blacklist

### WHAT

| Approach | Mechanism | Risk |
|----------|-----------|------|
| **Blacklist** | Reject known-bad protocols (`javascript:`, `data:`) | New dangerous protocols appear (e.g., `blob:`, `file:`, `ftp:`) |
| **Whitelist** | Only allow known-good protocols (`http:`, `https:`) | Safer; new protocols are rejected by default |

### WHY

A blacklist is a game of whack-a-mole. In 2015, developers blocked `javascript:` and `data:`. Then `vbscript:` appeared. Then `file:` became relevant. Then `blob:` and `filesystem:` emerged.

A whitelist is future-proof. If a new protocol is invented tomorrow, it is automatically rejected until an admin explicitly allows it.

### DECISION

Use an **explicit protocol whitelist**: only `http:` and `https:` are allowed. All other protocols are rejected regardless of what they are.

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Blacklist: `if (url.startsWith('javascript:')) reject` | Whitelist: `if (!['http:', 'https:'].includes(protocol)) reject` |
| Allow any protocol except a few known bad ones | Only allow protocols you explicitly trust |

## SOURCES

- [RFC 7231 — HTTP/1.1 Semantics and Content](https://datatracker.ietf.org/doc/html/rfc7231)
- [RFC 7538 — HTTP Status Code 308](https://datatracker.ietf.org/doc/html/rfc7538)
- [OWASP Unvalidated Redirects Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
