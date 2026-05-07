# Thinking Exercises: Answer Before Coding

## 1. The Expiry Dilemma

You have a mobile app. Users stay logged in for weeks. You want to use short-lived JWTs (15 minutes) for security, but refreshing every 15 minutes drains battery and uses data.

**Question:** How do you balance security vs UX? What's your approach?

---

## 2. The Revocation Problem

A user's phone is stolen. The thief has a valid JWT that expires in 7 days. You need to revoke it immediately.

**Question:** How do you revoke a JWT without making the system stateful?

**Hint:** There are three common approaches. None are perfect.

---

## 3. The Storage Question

Where do you store JWTs in a web app?

- `localStorage`?
- `sessionStorage`?
- `httpOnly` cookie?
- Memory only?

**Question:** What's the trade-off of each? Which do you choose and why?

**Hint:** Think about XSS, CSRF, and session persistence.

---

## 4. The Algorithm Trap

You receive a JWT with header: `{"alg":"none"}`. Your library rejects it. Good.

But what if the header is `{"alg":"HS256"}` and the server usually uses `RS256`? The server has the public key. How does verification work?

**Question:** Why is `alg` in the header at all? What attack does this enable?

---

## 5. The Secret Rotation

Your JWT secret has been compromised. You need to rotate it. But thousands of users have valid tokens signed with the old secret.

**Question:** How do you rotate the secret without logging out every user?

**Hint:** This is a deployment problem, not a crypto problem.
