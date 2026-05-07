# The Principle: What Did CORS Teach You?

## The Fundamental Truth

> **"CORS is a browser seatbelt, not a server lock. It protects users from drive-by attacks, not your API from direct assault."**

## The Junior Question

A junior dev says: "I disabled CORS with `origin: '*'` because it was blocking my frontend requests."

**What's the risk?**

<br><br><br><br><br>

---

## The Answer

With `origin: '*'`:
- Any website can make requests to your API
- If credentials are enabled, any website can make **authenticated** requests
- This is how CSRF attacks happen

**The right fix:** Configure CORS properly for your frontend origin. Don't disable it.

## The Realization

CORS errors in the browser are **security working correctly.** They're not bugs to fix by disabling CORS. They're signals that your frontend and backend aren't configured to trust each other.

**Fix the configuration, not the security.**
