# Three Wrong Ways to Get Client IP

---

## Wrong #1: First XFF IP

```javascript
const ip = req.headers['x-forwarded-for'].split(',')[0];
```

**Why it's wrong:** First IP is client-provided. Easily spoofed.

---

## Wrong #2: No Fallback

```javascript
const ip = req.headers['x-forwarded-for'];
```

**Why it's wrong:** If no proxy, header is undefined. `undefined.split()` crashes.

---

## Wrong #3: Trusting All Proxies

```javascript
app.set('trust proxy', true);
```

**Why it's wrong:** Trusts any `X-Forwarded-*` header from any source. Complete spoofing.
