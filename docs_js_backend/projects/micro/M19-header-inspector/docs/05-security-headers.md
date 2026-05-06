# Security Headers

## WHAT

Security headers are HTTP response directives that instruct browsers to enforce security policies. The most critical headers are:

| Header | Purpose |
|--------|---------|
| `Content-Security-Policy` (CSP) | Restricts sources for scripts, styles, images, etc. |
| `Strict-Transport-Security` (HSTS) | Forces HTTPS for a duration; prevents downgrade attacks. |
| `X-Frame-Options` | Prevents clickjacking by controlling iframe embedding. |
| `X-Content-Type-Options` | Prevents MIME-type sniffing (`nosniff`). |
| `Referrer-Policy` | Limits referrer information leakage. |
| `Permissions-Policy` | Disables browser features (camera, geolocation, etc.). |

## WHY

Even if your application code is secure, missing headers expose users to:

- **XSS:** Without CSP, a single injection can load arbitrary scripts.
- **Clickjacking:** Without `X-Frame-Options`, attackers embed your site in a transparent iframe.
- **Man-in-the-middle:** Without HSTS, SSL stripping downgrades connections to HTTP.

## HOW

**Express + Helmet:**

```javascript
const helmet = require("helmet");
app.use(helmet());
```

**Manual configuration:**

```javascript
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'nonce-random'; object-src 'none'; base-uri 'self';");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
```

## WRONG vs RIGHT

### WRONG: No Security Headers

```javascript
// BAD: Default Express headers expose app to XSS and clickjacking
const app = express();
app.get("/", (req, res) => res.send("Hello"));
```

### RIGHT: Helmet + Strict CSP

```javascript
// GOOD: Defense in depth
const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
      objectSrc: ["'none'"],
    },
  },
}));
```

## Breach Story: British Airways / Magecart (2018)

In 2018, attackers compromised British Airways' payment page by injecting a card-skimming script hosted on a lookalike domain (`baways.com`). The script exfiltrated 380,000 payment details. BA's Content-Security-Policy was either absent or permissive enough to allow the external script. A strict CSP with `script-src 'self'` and hash-based allowances would have blocked the injection.

## References

- OWASP: Content Security Policy Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- OWASP: HTTP Strict Transport Security — https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html
- MDN: Security Headers — https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security
- Scott Helme: securityheaders.com
