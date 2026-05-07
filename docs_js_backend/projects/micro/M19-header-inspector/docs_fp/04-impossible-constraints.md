# Impossible Constraint: No Proxy Knowledge

**Task:** Get the real client IP without knowing your proxy topology.

**Constraint:** You don't know how many proxies are between the client and your server.

---

## Your Turn

`X-Forwarded-For: 1.2.3.4, 5.6.7.8, 10.0.0.1`

Which is the real client IP? How do you know?

**Write your answer:**

<br><br><br><br><br>

---

## The Reveal: You Can't Know

Without knowing your proxy topology:
- Could be 1 proxy (10.0.0.1 is proxy, 5.6.7.8 is client)
- Could be 2 proxies (10.0.0.1 is yours, 5.6.7.8 is CDN, 1.2.3.4 is client)
- Could be spoofed (1.2.3.4 is fake)

**You MUST configure your proxy topology:**
```javascript
app.set('trust proxy', ['10.0.0.1', '10.0.0.2']); // Your known proxies
```

**This constraint forces you to realize:**

> You can't extract truth from headers without context. Headers are claims, not facts.
