# Fundamentals: Proxy Without Libraries

**Task:** Build a simple HTTP proxy using only Node.js `http`.

```javascript
const http = require('http');
const proxy = http.createServer((req, res) => {
  const options = {
    hostname: 'backend',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  req.pipe(proxyReq);
});
```

---

## Multiple Choice: Headers

**Q:** Should you forward `Host` header to the backend?

**A)** Yes, always

**B)** No, replace with backend's host

**C)** It depends on the backend

**D)** Remove entirely

**Think before reading on.**

---

## The Answer

**C is correct.**

- Some backends need the original Host (virtual hosting)
- Some backends need their own Host
- Some backends don't care

**Default behavior:** Replace with backend host (`changeOrigin: true`).
