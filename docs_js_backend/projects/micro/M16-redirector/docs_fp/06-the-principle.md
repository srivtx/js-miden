# The Principle: What Did Redirects Teach You?

## The Fundamental Truth

> **"A redirect is a trust transfer. You lend your domain's credibility to the target URL. Choose wisely."**

## The Junior Question

A junior dev says: "Why can't we just redirect anywhere? It's the user's choice where they go."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

Users don't choose. Attackers choose for them via phishing links.

When a user sees `https://yoursite.com/...`, they assume it's safe. If that redirect goes to evil.com, the attacker exploits YOUR trust.

**The real fix:** Don't have open redirects. Use intermediate pages:
```
"You're leaving our site to go to: [example.com]. Continue?"
```

## The Realization

Redirects are not "just routing." They're:
- Phishing vectors
- OAuth attack surfaces
- SSRF enablers
- Trust exploitation tools

Every redirect should be:
- Explicitly allowed
- Logged
- Time-limited (signed URLs)
- Warned (interstitial page)
