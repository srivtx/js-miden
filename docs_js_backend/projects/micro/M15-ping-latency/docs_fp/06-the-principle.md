# The Principle: What Did Ping Teach You?

## The Fundamental Truth

> **"Any endpoint that makes network requests on behalf of users is a proxy. And proxies are SSRF vulnerabilities unless explicitly restricted."**

## The Junior Question

A junior dev says: "It's just a ping. It only checks if a host is up."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

"Just a ping" can:
- Access internal metadata services
- Scan internal networks
- Reach services behind firewalls
- Exfiltrate data via DNS

**Any network request from the server is a potential SSRF.**
