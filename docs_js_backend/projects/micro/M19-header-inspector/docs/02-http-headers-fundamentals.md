# HTTP Headers Fundamentals

## WHAT

HTTP headers are colon-separated key-value pairs transmitted in the metadata of every HTTP request and response (RFC 7230). They are grouped into:

- **General headers:** `Date`, `Connection`, `Cache-Control`
- **Request headers:** `Host`, `User-Agent`, `Accept`, `Authorization`
- **Response headers:** `Server`, `Content-Type`, `Location`
- **Entity/Representation headers:** `Content-Length`, `ETag`, `Last-Modified`

In Node.js, headers arrive as an object where keys are lowercased by default in `http`/`https` modules.

## WHY

Headers are the **control plane** of the web:

- **Caching:** `Cache-Control`, `ETag` determine what is stored and for how long.
- **Content negotiation:** `Accept`, `Accept-Encoding` decide representation format.
- **Security:** `Strict-Transport-Security`, `Content-Security-Policy` harden the client.
- **Routing:** `Host`, `X-Forwarded-Host` direct traffic behind proxies.

Ignoring or misusing headers leads to cache poisoning, security bypasses, and routing errors.

## HOW

**Reading headers in Express:**

```javascript
app.get("/inspect", (req, res) => {
  // Headers are lowercased by Node.js
  const contentType = req.headers["content-type"];
  const auth = req.headers["authorization"];
  res.json({ contentType, auth });
});
```

**Setting security headers:**

```javascript
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
```

## WRONG vs RIGHT

### WRONG: Case-Sensitive Lookup

```javascript
// BAD: Will fail if the client sends "Authorization"
const token = req.headers["authorization"]; // actually ok in Express
// But if you use raw http:
const bad = req.headers["Authorization"]; // undefined in Node http module
```

> Node.js lowercases header keys. Always access with lowercase keys.

### RIGHT: Normalized Access

```javascript
// GOOD: Lowercase key lookup
const token = req.headers["authorization"];

// BETTER: Use a helper or framework abstraction
const getHeader = (req, name) => req.headers[name.toLowerCase()];
```

### WRONG: Blindly Concatenating Multi-Value Headers

```javascript
// BAD: X-Forwarded-For can be "1.1.1.1, 2.2.2.2, 3.3.3.3"
const ip = req.headers["x-forwarded-for"]; // String or array; not validated
```

### RIGHT: Parse and Validate

```javascript
// GOOD: Split, trim, and validate against allowlist or schema
const forwarded = req.headers["x-forwarded-for"];
const ips = forwarded ? forwarded.split(",").map(s => s.trim()) : [];
const clientIp = ips[0]; // Still untrusted; see x-forwarded-for.md
```

## References

- RFC 7230 — HTTP/1.1 Message Syntax and Routing
- RFC 7231 — HTTP/1.1 Semantics and Content
- RFC 9110 — HTTP Semantics (June 2022)
- MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers
