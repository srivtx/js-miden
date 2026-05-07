# Three Wrong Ways to Validate Redirects

---

## Wrong #1: StartsWith Check

```javascript
if (req.query.to.startsWith('https://yoursite.com')) {
  res.redirect(req.query.to);
}
```

**Why it looks right:** Only allow redirects to your domain.

**Why it's wrong:**
```
https://yoursite.com.evil.com   // startsWith passes!
https://yoursite.com@evil.com   // URL parser sees evil.com
```

---

## Wrong #2: Regex Without Anchor

```javascript
if (/yoursite\.com/.test(req.query.to)) {
  res.redirect(req.query.to);
}
```

**Why it looks right:** Check for your domain in the URL.

**Why it's wrong:**
```
https://evil.com?yoursite.com=1   // regex matches!
https://notyoursite.com           // regex matches "yoursite.com" substring!
```

---

## Wrong #3: Allowing Relative URLs

```javascript
if (req.query.to.startsWith('/')) {
  res.redirect(req.query.to); // Safe, right?
}
```

**Why it looks right:** Relative URLs stay on your domain.

**Why it's wrong:**
```
//\evil.com     // Some browsers interpret as protocol-relative
\evil.com       // Backslash is treated as slash in some parsers
```
