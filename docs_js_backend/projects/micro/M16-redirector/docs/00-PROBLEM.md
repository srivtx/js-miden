# 00-PROBLEM.md — Simple Redirector (M16)

## WHAT

Build an HTTP API that:

1. **POST /redirect** — Accepts a JSON body `{ "url": "https://example.com" }` and returns a **302 Found** redirect to the given URL.
2. **GET /info** — Returns the incoming request headers, method, IP, and URL for debugging.
3. **Validates redirect URLs strictly** — only `http:` and `https:` protocols allowed.
4. **Rejects dangerous protocols** — `javascript:`, `data:`, `file:`, `vbscript:`, `about:` must all be blocked.
5. **Prevents open redirect attacks** usable for phishing and XSS.

The redirector must parse the URL with the built-in `URL` constructor, inspect the protocol, ensure a non-empty hostname, and only then issue the redirect.

## WHY

Open redirects are one of the most underestimated vulnerabilities:

- **Phishing**: `https://trusted-bank.com/redirect?url=https://evil.com` tricks users because the visible domain is trusted, but the landing page is malicious.
- **XSS via `javascript:`**: `javascript:alert(document.cookie)` executes in the context of the original site's origin, bypassing Content Security Policy for inline scripts.
- **Data exfiltration**: `data:text/html,<script>…</script>` can steal `localStorage` tokens or session cookies.
- **OAuth token theft**: Many OAuth flows include a `redirect_uri` parameter; if not validated, attackers intercept authorization codes.

A seemingly harmless "redirect to this URL" feature has been the root cause of breaches at Facebook, Google, and major banks.

## CONSTRAINTS

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Allowed protocols | `http:`, `https:` | Only safe, well-understood transport |
| Default status | `302 Found` | Temporary; browsers do not cache aggressively |
| Validation | `URL` constructor + protocol whitelist | Parsing before validation prevents bypasses |
| Response body | Empty or minimal | Redirects should not carry content |
| Rejection status | `400 Bad Request` | Client error; the submitted URL is invalid |

## SCOPE

### In Scope
- Express route for `POST /redirect` with JSON body parsing.
- Protocol whitelist validation (`http:`, `https:`).
- Hostname presence check.
- `GET /info` for debugging headers.
- Tests for valid URLs, `javascript:`, `data:`, and missing URLs.

### Out of Scope
- Domain whitelist (e.g., only allow `example.com`).
- URL shortening / slug generation.
- Click analytics or logging.
- OAuth `redirect_uri` validation (conceptually similar but out of scope).
- 307/308 redirects (discussed in design decisions but not default).

## ACCEPTANCE CRITERIA

1. `POST /redirect` with `{ "url": "https://example.com" }` returns `302` with `Location: https://example.com`.
2. `POST /redirect` with `{ "url": "javascript:alert('xss')" }` returns `400` with error "Invalid or unsafe URL".
3. `POST /redirect` with `{ "url": "data:text/html,<script>alert(1)</script>" }` returns `400`.
4. `POST /redirect` with `{}` returns `400` with error "Missing url in request body".
5. `GET /info` returns `200` with `headers`, `ip`, `method`, and `url`.

## SOURCES

- [RFC 7231 — HTTP/1.1 Semantics and Content (Redirects)](https://datatracker.ietf.org/doc/html/rfc7231)
- [RFC 7538 — HTTP Status Code 308](https://datatracker.ietf.org/doc/html/rfc7538)
- [OWASP Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html)
- [CWE-601: URL Redirection to Untrusted Site ('Open Redirect')](https://cwe.mitre.org/data/definitions/601.html)
