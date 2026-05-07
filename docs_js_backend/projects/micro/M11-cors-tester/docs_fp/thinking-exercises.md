# Thinking Exercises

## 1. The Subdomain Problem

Your API serves `api.example.com`. Your frontend is `app.example.com`. You want to allow `*.example.com`.

**Question:** What's the risk? How do you mitigate it?

---

## 2. The Localhost Problem

Your dev config allows `http://localhost:3000`. A production user somehow has something running on localhost.

**Question:** Can they exploit this? How?

---

## 3. The Credentials Dilemma

You need cookies for auth. But cookies require `credentials: true`. But `credentials: true` requires a specific origin (not wildcard).

**Question:** How do you handle multiple frontend origins (web, admin, mobile web)?

---

## 4. The Preflight Cost

Every POST request triggers an OPTIONS preflight. That's 2x the requests.

**Question:** How do you reduce preflight frequency? What are the trade-offs?

---

## 5. The Vary Header

Your CORS response varies by `Origin`. But you also cache responses with CDN.

**Question:** What happens if you don't include `Vary: Origin`? How do you test this?
