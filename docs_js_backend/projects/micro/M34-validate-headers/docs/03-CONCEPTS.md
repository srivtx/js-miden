# M34: Core Concepts

## WHAT
HTTP header names are case-insensitive per RFC 2616 Section 4.2.

## WHY
Clients may send `content-type`, `Content-Type`, or `CONTENT-TYPE`. The server must treat them identically.

## HOW
Node.js lowercases all incoming headers: `req.headers['content-type']` works, but `req.headers['Content-Type']` also works because Node normalizes keys.
However, iterating over custom rule names with exact case is fragile.

## WRONG vs RIGHT

**WRONG**: Case-sensitive comparison in custom validator
```ts
const value = req.headers[rule.name]; // 'Content-Type' vs 'content-type'
```

**RIGHT**: Normalize lookup
```ts
const value = req.get(rule.name); // Express normalizes case
// or
const value = req.headers[rule.name.toLowerCase()];
```
