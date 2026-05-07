# The Principle: What Did Headers Teach You?

## The Fundamental Truth

> **"HTTP headers are claims made by intermediaries. Claims require verification. Trust without verification is vulnerability."**

## The Junior Question

A junior dev says: "We use X-Forwarded-For to get the real IP. It's set by our load balancer."

**What's the risk?**

<br><br><br><br><br>

---

## The Answer

What if:
- The request bypasses the load balancer?
- A previous proxy already added a fake XFF?
- Your app is directly exposed to the internet?

**Always validate proxy topology. Never trust headers blindly.**
