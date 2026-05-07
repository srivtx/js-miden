# The 3AM Page: The Wrong Format

It's 3:00 AM. Mobile app is crashing.

**Mobile:** "API returns HTML error page instead of JSON. App crashes parsing HTML as JSON."

You check the API:
```javascript
res.send(error.message); // Sends plain text!
```

No content negotiation. No format selection. Always returns whatever.

**Clients expect JSON. Server sends text. Chaos.**
