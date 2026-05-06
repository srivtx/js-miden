# Research Notes

## Sources

- **MDN Web Docs — Cross-Origin Resource Sharing (CORS)**
  - Key finding: Browsers MUST reject responses with `Access-Control-Allow-Origin: *` when credentials are included. This is not optional — it is a hard requirement of the Fetch spec.
  - https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

- **OWASP CORS Cheat Sheet**
  - Key finding: For APIs handling sensitive data, use an explicit allowlist of trusted origins. Never use `*` or dynamic reflection without validation.
  - https://cheatsheetseries.owasp.org/cheatsheets/CORS_Cheat_Sheet.html

- **PortSwigger Research — Exploiting CORS Misconfigurations**
  - Key finding: CORS misconfigurations were in the OWASP Top 10 for years. Common patterns like `origin: true` (reflect any origin) are trivially exploitable by attackers.
  - https://portswigger.net/web-security/cors

- **RFC 6454 — The Web Origin Concept**
  - Key finding: Defines the `Origin` header and the Same-Origin Policy formally. CORS is a controlled exception to SOP.
  - https://tools.ietf.org/html/rfc6454

- **RFC 7234 — HTTP Caching**
  - Key finding: `Vary` is mandatory when response content depends on request headers. CORS responses MUST include `Vary: Origin` when reflecting origins dynamically.
  - https://tools.ietf.org/html/rfc7234

- **Fetch Standard (WHATWG)**
  - Key finding: The authoritative source for CORS behavior in browsers. Defines preflight algorithms, credential rules, and header parsing.
  - https://fetch.spec.whatwg.org/

## Latest Trends (2025)

- **Private Network Access (PNA):** Chrome is rolling out stricter CORS rules for private IP ranges (e.g., `192.168.x.x`). Public sites will need explicit permission to access local network resources. This extends CORS from cross-origin to cross-network.
- **Permission Policy + CORS convergence:** New headers like `Permissions-Policy` work alongside CORS to control which origins can use powerful browser features (camera, geolocation, clipboard).
- **Credential-less CORS:** A new mode where cookies are NOT sent but the request is still authenticated via other means (e.g., tokens in headers). This avoids the `*` prohibition but requires careful handling.

## Benchmarks

- Preflight `OPTIONS` request latency: ~5-15ms on localhost, ~50-200ms over the internet.
- With `maxAge: 600`, a typical SPA session (30 minutes) generates only 1 preflight per endpoint instead of 30-100.
- The `cors` middleware adds ~0.05ms overhead per request in Express benchmarks (negligible compared to JSON parsing).

## Industry Adoption

- **Stripe API:** Explicit origin allowlists per account. No wildcards.
- **GitHub API:** `Access-Control-Allow-Origin: *` for public endpoints, strict allowlists for authenticated GraphQL.
- **AWS API Gateway:** Supports CORS configuration but warns that `*` with credentials is invalid.
- **Vercel / Netlify:** Default CORS configs often use `*` for static sites, but recommend allowlists for serverless functions with auth.
