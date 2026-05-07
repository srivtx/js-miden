# Thinking Exercises

## 1. The Subdomain

You allow `*.yoursite.com`. A user registers `evil.yoursite.com`.

**Question:** Is this a redirect vulnerability? How?

---

## 2. The URL Shortener

Your URL shortener creates `https://yoursite.com/r/abc123` → any URL.

**Question:** How is this different from an open redirect? Is it safer?

---

## 3. The Signed URL

You sign redirect URLs with HMAC: `?to=evil.com&sig=abc123`.

**Question:** Does this prevent abuse? What if the signature leaks?

---

## 4. The Post-Redirect

You redirect after form submission (POST-redirect-GET pattern).

**Question:** What data leaks in the redirect URL? How do you prevent it?

---

## 5. The Protocol

You allow `https://` only. What about `http://`? `ftp://`? `javascript://`?

**Question:** Which protocols are dangerous in redirects? Why?
