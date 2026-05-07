# Fundamentals: CORS Without the cors Middleware

**Task:** Implement CORS handling using only raw Node.js `http`.

A CORS preflight request looks like:
```
OPTIONS /api/data HTTP/1.1
Origin: https://example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

Your server must respond:
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://example.com
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

---

## Multiple Choice: Preflight

**Q:** When does the browser send a preflight OPTIONS request?

**A)** For every cross-origin request

**B)** Only for GET and POST requests

**C)** For "simple" requests with custom headers or non-simple methods

**D)** Only when credentials are included

**Think before reading on.**

---

## The Answer

**C is correct.**

- **A:** Not every request. "Simple" requests (GET, POST with specific content-types, no custom headers) skip preflight.
- **B:** GET and POST can be simple requests. Preflight is for the OTHERS.
- **C:** Correct. Preflight checks if the server allows the actual request.
- **D:** Credentials trigger additional checks but not necessarily preflight.

**Simple requests:** GET, HEAD, POST with `Content-Type: text/plain`, `multipart/form-data`, or `application/x-www-form-urlencoded`.

**Preflighted requests:** Everything else (PUT, DELETE, JSON content, custom headers).
