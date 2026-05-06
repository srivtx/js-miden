# Common Pitfalls

## WHAT

HTTP header handling is full of subtle traps. This document covers the most dangerous mistakes in header inspection and proxy handling.

## Pitfall 1: Case-Sensitive Header Lookup

**WRONG:**
```javascript
const auth = req.headers["Authorization"]; // undefined in Node http module
```

**RIGHT:**
```javascript
const auth = req.headers["authorization"]; // Node lowercases keys
```

## Pitfall 2: Trusting `X-Forwarded-For` Blindly

**WRONG:**
```javascript
const clientIp = req.headers["x-forwarded-for"]?.split(",")[0];
```

**RIGHT:**
```javascript
app.set("trust proxy", 2);
const clientIp = req.ip; // Express handles proxy chain safely
```

## Pitfall 3: Logging Sensitive Headers

**WRONG:**
```javascript
console.log(req.headers); // Logs Authorization, Cookie, X-Api-Key
```

**RIGHT:**
```javascript
const safe = { ...req.headers };
delete safe["authorization"];
delete safe["cookie"];
delete safe["x-api-key"];
console.log(safe);
```

## Pitfall 4: Missing Security Headers

**WRONG:**
```javascript
const app = express();
app.get("/", (req, res) => res.send("Hello"));
```

**RIGHT:**
```javascript
const helmet = require("helmet");
app.use(helmet());
```

## Pitfall 5: Not Stripping Proxy Headers at the Edge

**WRONG:**
```javascript
// Client sends X-Forwarded-Proto: https over HTTP
// App trusts it and sets Secure cookies
const proto = req.headers["x-forwarded-proto"] || "http";
```

**RIGHT:**
```javascript
// Strip at CDN / load balancer; trust only known proxies
app.set("trust proxy", ["loopback", "10.0.0.0/8"]);
```

## Pitfall 6: Ignoring Multi-Value Headers

**WRONG:**
```javascript
const accept = req.headers["accept"]; // May be array in some frameworks
```

**RIGHT:**
```javascript
const accept = Array.isArray(req.headers["accept"])
  ? req.headers["accept"].join(",")
  : req.headers["accept"];
```

## References

- OWASP HTTP Headers Cheat Sheet
- RFC 9110 — HTTP Semantics
- Helmet.js Documentation
