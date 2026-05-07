# Thinking Exercises

## 1. The Chain

You see: `X-Forwarded-For: 1.1.1.1, 2.2.2.2, 10.0.0.1, 10.0.0.2`

**Question:** How many proxies? Which IP do you trust?

---

## 2. The Internal IP

Your load balancer adds `X-Forwarded-For: 10.0.0.5` (internal IP).

**Question:** Is this useful? What does it tell you?

---

## 3. The VPN

User connects via VPN. XFF shows VPN IP, not real IP.

**Question:** Is this a problem? For what use cases?

---

## 4. The IPv6

XFF contains IPv6: `2001:db8::1`.

**Question:** Does your IP parsing handle IPv6? What breaks?

---

## 5. The Missing Header

No XFF header. Direct connection.

**Question:** What IP do you use? Is `req.ip` safe?
