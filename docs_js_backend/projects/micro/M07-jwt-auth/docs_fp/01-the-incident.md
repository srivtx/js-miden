# The 3AM Page: The Token That Never Dies

It's 3:47 AM. Your phone vibrates off the nightstand.

**PagerDuty:** `[CRITICAL] User reports seeing another user's data`

You stumble to your laptop. The user — let's call her Sarah — just tweeted a screenshot. She's logged into your app and seeing **someone else's dashboard**. Name, email, recent orders. All of it.

You check the logs. Sarah's request has a JWT in the `Authorization` header. You decode it. The `sub` (subject) claim is `"admin"`. The `exp` (expiry) claim is... **missing entirely**.

The token was issued in **2020**.

---

## Your Turn: Answer Before Reading On

### Question 1: How is a 5-year-old token still working?

Think about it. JWTs are "stateless" — the server doesn't store them. So how does the server "know" a token expired?

- [ ] The server stores all issued tokens in a database and checks
- [ ] The token contains an expiry claim that the server validates
- [ ] The browser automatically deletes cookies after a date
- [ ] The server uses session storage

**Write your answer here before scrolling down.**

<br><br><br><br><br>

---

## The Autopsy

### Answer 1: The token contains an expiry claim...

...but the server **isn't checking it**.

Look at this code (the bug):

```javascript
jwt.verify(token, secret, { ignoreExpiration: true });
```

That `ignoreExpiration: true` means: "I see the `exp` claim. I don't care. Let it through."

**Why would anyone write this?** Because during development, tokens kept expiring while debugging. Someone added `ignoreExpiration: true` as a "temporary" fix. It shipped to production. That was 5 years ago.

### The Deeper Truth

JWTs are **self-contained** but **not self-enforcing**. The token *says* when it expires, but the server *decides* whether to care. This is different from session cookies, where the server looks up the session in a database and can revoke it centrally.

With JWTs: **revocation is hard**. If you want to revoke a token before expiry, you need a blocklist (which makes JWTs stateful, defeating the purpose). So expiry is your primary defense — and this code just disabled it.

---

### Question 2: Why is Sarah seeing someone else's data?

The token's `sub` claim is `"admin"`. Not a user ID. The string `"admin"`. 

Look at the database lookup:

```javascript
const user = await db.users.findFirst({ where: { role: token.sub } });
```

It's querying by **role**, not by **user ID**. The token was probably meant for an admin panel endpoint, but it's being accepted on regular API endpoints too. Every request with `sub: "admin"` returns the first admin user in the database.

**This is two bugs in one:**
1. No expiry check (token lives forever)
2. Wrong claim used for authorization (`sub` should be user ID, not role)

---

### Question 3: How do you fix this without breaking all logged-in users?

You can't just flip `ignoreExpiration: false`. Every user with an old token would be instantly logged out. In a mobile app, that means force-updating the app or users thinking they were hacked.

**The real-world fix:**
1. Deploy a new version that checks expiry: `ignoreExpiration: false`
2. Simultaneously deploy a "token refresh" endpoint that accepts old tokens and issues new ones
3. Set a short expiry on new tokens (15 minutes) + long-lived refresh tokens
4. Mobile apps and web clients need updates to handle refresh

This is a **2-week project** disguised as a one-line fix.

---

## The Principle

> **"JWT expiry is not a suggestion. It's the only wall between a stolen token and perpetual access."**

Session cookies expire server-side. JWTs expire client-side... unless you check. The `ignoreExpiration` flag exists for testing. Using it in production is like leaving your house key under the mat with a sign that says "key under mat."

---

## Real-World Incident

**Facebook (2018):** A bug in their "View As" feature allowed attackers to steal access tokens. The tokens were long-lived. 50 million accounts affected. The fix required invalidating all tokens — which logged out every user globally.

**Lesson:** If your tokens can't be revoked individually, you have to revoke them all. That's the nuclear option.
