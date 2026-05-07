# The 3AM Page: The Spoofed IP

It's 4:00 AM. Your fraud team is alarmed.

**Fraud:** "We have 10,000 login attempts from 127.0.0.1. All successful."

You check the code:
```javascript
const clientIp = req.headers['x-forwarded-for'] || req.ip;
```

**The attacker sent:**
```
X-Forwarded-For: 127.0.0.1
```

Your app trusts this header blindly. The attacker bypassed IP-based rate limiting, geo-blocking, and fraud detection.

**All by setting a single HTTP header.**

---

## Your Turn

### Q1: Why is `X-Forwarded-For` untrustworthy?

It's set by proxies. Shouldn't it be reliable?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Clients can set it

`X-Forwarded-For` is a **de facto standard** header added by proxies. But:
- The client can send it first
- Each proxy APPENDS to it
- The first IP in the list might be the client's real IP... or a lie

**Example:**
```
X-Forwarded-For: 1.2.3.4, 10.0.0.1, 10.0.0.2
```

- `1.2.3.4` — Client's claimed IP (could be fake)
- `10.0.0.1` — First proxy
- `10.0.0.2` — Second proxy (your load balancer)

**If you take the FIRST IP, you trust the client.**

**If you take the LAST IP, you get your load balancer (10.0.0.2).**

### The Fix

```javascript
// Trust only your load balancer (last IP before it)
const clientIp = req.headers['x-forwarded-for']?.split(',').pop()?.trim() || req.ip;
```

Better yet, use a library like `proxy-addr` that knows your proxy topology.
