# Proxy Headers

## WHAT

When a request passes through reverse proxies or load balancers, the application behind them loses information about the original request. A family of headers restores this context:

| Header | Purpose |
|--------|---------|
| `X-Forwarded-For` | Original client IP chain |
| `X-Forwarded-Proto` | Original scheme (`http` vs `https`) |
| `X-Forwarded-Host` | Original `Host` header |
| `X-Forwarded-Port` | Original port |
| `X-Real-IP` | Single original client IP (NGINX convention) |

RFC 7239 (`Forwarded`) is the standardized, structured equivalent but is less widely deployed.

## WHY

Applications need the original context for:

- **URL generation:** If the app generates a redirect URL using `http://` while the user accessed via `https://`, browsers block mixed-content requests.
- **Cookie `Secure` flag:** Cookies marked `Secure` are not sent over `http://`.
- **Rate limiting:** Must target the real client IP, not the proxy.
- **Virtual hosting:** The `Host` header may be rewritten by the proxy.

However, **trusting these headers blindly** leads to cache poisoning, open redirects, and security header bypasses.

## HOW

**Strip untrusted proxy headers at the edge.**

Your outermost proxy (e.g., Cloudflare, AWS ALB) should strip `X-Forwarded-*` from the client and set its own. Inner layers should only trust the immediate upstream.

```nginx
# NGINX: strip client-supplied XFF and set a clean one
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
```

**In Express:**

```javascript
// Trust only specific proxies (CIDR blocks)
app.set("trust proxy", ["loopback", "10.0.0.0/8"]);
// Now req.protocol and req.ip respect proxy headers safely
```

## WRONG vs RIGHT

### WRONG: Use `X-Forwarded-Proto` Without Validation

```javascript
// BAD: Attacker sets X-Forwarded-Proto: https over plain HTTP
// App generates https:// URLs, but connection is insecure
const baseUrl = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
```

### RIGHT: Enforce at the Edge

```javascript
// GOOD: Trust proxy setting validates hop chain
app.set("trust proxy", "loopback, 10.0.0.0/8");

// Express handles X-Forwarded-Proto safely
const baseUrl = `${req.protocol}://${req.get("host")}`;
```

## Breach Story: HTTPoxy (2016, CVE-2016-5385)

`HTTPoxy` was a vulnerability affecting CGI-based applications. The `Proxy` header, sent by clients, was converted to the `HTTP_PROXY` environment variable. Application code then routed outbound HTTP requests through the attacker-controlled proxy, leaking internal data and enabling SSRF. The root cause: proxy headers were passed through to application context without sanitization.

Affected: PHP, Go, Python, and others. Mitigation: strip or ignore the `Proxy` header at the edge.

## References

- RFC 7239 — Forwarded HTTP Extension
- CVE-2016-5385 — HTTPoxy
- OWASP: Securing the Edge — https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html
