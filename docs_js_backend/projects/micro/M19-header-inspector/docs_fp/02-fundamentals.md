# Fundamentals: HTTP Headers Without Express

**Task:** Parse raw HTTP headers from a Node.js socket.

HTTP request:
```
GET /api/data HTTP/1.1
Host: example.com
X-Custom-Header: value
content-type: application/json
```

---

## Multiple Choice: Header Case

**Q:** Are these the same header?
```
Content-Type: application/json
content-type: application/json
CONTENT-TYPE: application/json
```

**A)** No, headers are case-sensitive

**B)** Yes, HTTP/1.1 specifies case-insensitive headers

**C)** Only in HTTP/2

**D)** It depends on the server implementation

**Think before reading on.**

---

## The Answer

**B is correct.**

HTTP/1.1 (RFC 7230): "Each header field consists of a case-insensitive field name..."

**But:** `req.headers` in Node.js lowercases all headers for convenience.

**The trap:**
```javascript
// This works in Express/Node.js (lowercased)
req.headers['content-type']

// But raw HTTP parsers might not lowercase
// Some proxies preserve original case
```

**Always normalize header names to lowercase before comparing.**
