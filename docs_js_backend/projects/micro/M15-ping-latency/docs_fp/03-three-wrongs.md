# Three Wrong Ways to Prevent SSRF

---

## Wrong #1: Blacklist

```javascript
const blocked = ['localhost', '127.0.0.1', '169.254.169.254'];
if (blocked.includes(host)) return 403;
```

**Why it's wrong:**
- `0.0.0.0` is not blocked
- `0000000000000001` is 127.0.0.1 in decimal
- `0177.0.0.1` is octal for 127.0.0.1
- `::1` is IPv6 localhost

**Blacklists are always incomplete.**

---

## Wrong #2: No DNS Validation

```javascript
// Only check hostname, not resolved IP
if (!host.includes('internal')) {
  await ping(host);
}
```

**Why it's wrong:** Hostname can be anything. DNS resolution might return internal IP.

---

## Wrong #3: Allowing Redirects

```javascript
const response = await fetch(url, { redirect: 'follow' });
```

**Why it's wrong:** Initial URL is public. Redirect goes to internal.
