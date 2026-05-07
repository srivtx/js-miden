# The Principle: What Did Webhooks Teach You?

## The Fundamental Truth

> **"A webhook is an API call from a stranger. Verify their identity before acting on their claims."**

## The Junior Question

A junior dev says: "Webhooks come from Stripe. We can trust them."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

"Comes from Stripe" is an assumption, not a fact.

- DNS can be poisoned
- IPs can be spoofed (in some contexts)
- The URL might be public
- A bug in your routing might expose the endpoint

**Verify identity cryptographically. Trust but verify.**
