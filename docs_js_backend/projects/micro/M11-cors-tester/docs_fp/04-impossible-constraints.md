# Impossible Constraint: No Origin Header

**Task:** Your API needs to accept authenticated requests from a mobile app.

**Constraint:** Mobile apps don't send `Origin` headers. How do you secure CORS?

---

## Your Turn

Mobile apps and curl requests don't have `Origin`. How do you distinguish legitimate mobile requests from malicious web requests?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Can't (And Shouldn't Try)

CORS only applies to browsers. Mobile apps, curl, Postman — none of them enforce CORS.

**The constraint forces you to realize:**

> CORS is not API security. It's a browser security feature.

If your API security relies on CORS, you've already lost. Real API security:
- Authentication (tokens, API keys)
- Authorization (RBAC, scopes)
- Rate limiting
- Input validation
- HTTPS

CORS is for UX (preventing unwanted cross-origin requests in browsers), not security.
