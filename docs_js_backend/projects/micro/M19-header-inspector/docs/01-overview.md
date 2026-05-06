# M19: Header Inspector — Overview

## WHAT

The **Header Inspector** is a microservice that ingests HTTP request metadata, parses headers, and returns a structured analysis including:

- Parsed request and response headers.
- Detected proxy hops via `X-Forwarded-For` and friends.
- Security header presence and validity scores.
- IP spoofing risk indicators.

It is useful for debugging, security auditing, and API gateway instrumentation.

## WHY

HTTP headers are invisible to most application code but carry enormous security and correctness implications:

- Missing security headers enable XSS and clickjacking.
- Misconfigured `X-Forwarded-For` handling exposes internal IPs or allows IP spoofing.
- Duplicate or conflicting headers can crash parsers (HTTP Request Smuggling — CVE-2021-44790).

## HOW

**Core inspection pipeline:**

1. **Ingest** raw request headers.
2. **Normalize** keys to lowercase; parse multi-value headers.
3. **Classify** headers into categories: security, proxy, content, custom.
4. **Evaluate** security posture (missing `CSP`, `HSTS`, etc.).
5. **Detect** IP spoofing by analyzing `X-Forwarded-For` chain length and private IP leakage.

```javascript
const express = require("express");
const app = express();

app.get("/inspect", (req, res) => {
  const report = {
    headers: req.headers,
    securityScore: evaluateSecurityHeaders(req.headers),
    forwardedChain: parseForwardedFor(req.headers["x-forwarded-for"]),
    spoofingRisk: detectSpoofing(req.headers),
  };
  res.json(report);
});
```

## WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Trust `req.ip` or `req.connection.remoteAddress` as the true client IP in proxied environments. | Use a configurable number of trusted proxies; pick the rightmost untrusted IP in `X-Forwarded-For`. |
| Ignore missing security headers. | Report them and provide remediation links. |
| Log full `Authorization` or `Cookie` headers verbatim. | Redact sensitive values before logging or inspection output. |
| Parse headers as a single string without handling arrays. | Normalize multi-value headers per RFC 9110. |

## References

- RFC 9110 — HTTP Semantics
- OWASP Cheat Sheet: HTTP Headers: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- MDN: HTTP Headers
