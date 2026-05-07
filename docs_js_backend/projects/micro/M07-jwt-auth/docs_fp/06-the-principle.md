# The Principle: What Did JWTs Teach You?

## The Fundamental Truth

> **"Statelessness is a trade-off, not a feature. You trade central control for scalability. If you don't need the scale, you pay the price for nothing."**

JWTs are often used because they're "modern" and "stateless." But statelessness means:
- No instant revocation (you need a blocklist)
- No way to know how many sessions a user has
- No way to force-logout all devices
- Bigger payloads (the entire session is in the token)

**When are JWTs actually the right choice?**
- Microservices where passing session IDs between services is painful
- Mobile apps where cookies are awkward
- Short-lived tokens (5-15 minutes) with refresh tokens

**When are sessions better?**
- Traditional web apps
- When you need instant revocation
- When payload size matters
- When you want to track active sessions

## The Junior Question

A junior dev says: "JWTs are more secure than sessions because they're encrypted."

**What's wrong with this statement?**

<br><br><br><br><br>

---

## The Answer

JWTs are **signed**, not encrypted. Anyone can read the payload:

```bash
echo "eyJzdWIiOiIxMjM0NTY3ODkwIn0" | base64 -d
# {"sub":"1234567890"}
```

If you put sensitive data in a JWT, it's visible to anyone who intercepts it. Use JWE (Encrypted JWT) if you need confidentiality — but most of the time, you shouldn't put sensitive data in the token at all.

**Sessions store data server-side.** The client only gets an opaque ID. That's inherently more private.

## The Realization

JWTs aren't "better" than sessions. They're **different**. The choice depends on:
1. Architecture (microservices vs monolith)
2. Revocation needs
3. Payload sensitivity
4. Client types (web, mobile, IoT)

"Use JWTs because they're modern" is cargo-culting. Understand the trade-off.
