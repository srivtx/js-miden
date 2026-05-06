# M19: Header Inspector

A micro API for inspecting incoming HTTP headers, extracting the client IP securely, and analyzing security headers.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/headers` | Returns all request headers |
| GET | `/ip` | Returns the client IP (safely extracted behind proxies) |
| GET | `/security` | Analyzes security headers present on the request |
| GET | `/health` | Health check |

## Request

```bash
curl http://localhost:3000/headers
curl http://localhost:3000/ip
curl http://localhost:3000/security
```

## Response

```json
// GET /ip
{
  "ip": "203.0.113.42",
  "source": "x-forwarded-for",
  "trusted": true
}
```

## Thinking Framework

### PHASE 1: Basic Inspection
- Echo back `req.headers` as a sanitized object
- Extract IP from `req.ip` or `req.socket.remoteAddress`
- List known security headers and mark them present/missing

### PHASE 2: Production Hardening
- **X-Forwarded-For Spoofing**: This header is trivially forged by clients. If your app is behind a load balancer, trust **only** the last hop added by the proxy. If exposed directly to the internet, `X-Forwarded-For` must be ignored entirely.
- **Proxy Headers**: `X-Real-IP`, `CF-Connecting-IP`, `True-Client-IP` are also proxy-dependent. Validate against a whitelist of known proxy IPs.
- **Security Headers Analysis**: Check for:
  - `Strict-Transport-Security` (HSTS)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options` / `Content-Security-Policy` (frame-ancestors)
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `Permissions-Policy`
- **Response Security Headers**: The API itself should set security headers to prevent XSS and clickjacking.

### PHASE 3: Security & Edge Cases
- **IP Format Validation**: Validate IPv4/IPv6 format before returning.
- **Private IP Leakage**: Don't expose internal proxy IPs to the client.
- **Multiple XFF Values**: `X-Forwarded-For: client, proxy1, proxy2`. The rightmost trusted proxy is the real client (or the leftmost untrusted if you know your proxy chain).
- **Rate Limiting Context**: IP extraction is critical for rate limiting. A spoofable IP bypasses all limits.

## Bug

The buggy version is in `src/inspector.buggy.ts`. It has **two** vulnerabilities:

1. **IP Spoofing via X-Forwarded-For**: It blindly trusts `req.headers['x-forwarded-for']` and returns the **first** (leftmost) value. An attacker can send `X-Forwarded-For: 1.2.3.4` and the API reports `1.2.3.4` as their IP. This bypasses IP-based rate limits, geo-blocks, and audit logs.
2. **Missing Security Headers**: The buggy app does not set `X-Content-Type-Options`, `X-Frame-Options`, or `Content-Security-Policy` on its own responses. If the inspector page is rendered in a browser, it is vulnerable to clickjacking and MIME-sniffing XSS.

## Setup

```bash
cd docs_js_backend/projects/micro/M19-header-inspector
npm install
npm run dev
```

## Tests

```bash
npm test
```
