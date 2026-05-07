# Fundamentals: URL Parsing from Scratch

**Task:** Parse a URL and validate its hostname without `new URL()`.

You receive: `https://user:pass@example.com:8080/path?query=1#frag`

---

## Multiple Choice: Hostname Extraction

**Q:** Given `https://evil.com/https://good.com`, what's the hostname?

**A)** `evil.com`

**B)** `good.com`

**C)** Both

**D)** Depends on the parser

**Think before reading on.**

---

## The Answer

**D is correct.**

If you naively search for `https://`:
```javascript
const url = req.query.to;
const hostname = url.split('https://')[1].split('/')[0];
// For "https://evil.com/https://good.com"
// Result: "evil.com"
```

But what about:
```javascript
// URL-encoded:
https%3A%2F%2Fevil.com%2Fhttps%3A%2F%2Fgood.com

// Double-encoded:
https%253A%252F%252Fevil.com

// With @ trick:
https://good.com@evil.com/
// new URL() gives hostname=evil.com, but regex might give good.com
```

**The only safe way:** Use a proper URL parser and validate the hostname explicitly.
