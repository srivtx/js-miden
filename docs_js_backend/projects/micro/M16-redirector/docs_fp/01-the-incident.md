# The 3AM Page: The Phishing Link

It's 6:00 AM. Your security team is on a war room call.

**Security:** "Phishing emails are using our domain. Links look like `https://yoursite.com/redirect?to=https://evil-bank.com`"

Your redirect service:
```javascript
app.get('/redirect', (req, res) => {
  res.redirect(req.query.to);
});
```

Any URL. No validation. Attackers use YOUR domain to phish users.

**Why it works:** Users trust `yoursite.com`. They click. The redirect takes them to a fake bank site that looks real.

**Impact:** Users lose money. Your brand is tarnished. Regulatory fines.

---

## Your Turn

### Q1: Why is `res.redirect(userInput)` dangerous?

It's just a redirect. What's the harm?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Trust transfer

When you redirect from your domain, the user's browser:
1. Shows your domain in the URL bar initially
2. Then jumps to the attacker's site
3. The attacker can fake your UI (login page, payment form)
4. User enters credentials, thinking they're on your site

**This is an open redirect vulnerability.** It's in the OWASP Top 10.

### The Deeper Problem

Your redirector also accepts:
- `javascript:alert(document.cookie)` — XSS
- `file:///etc/passwd` — Local file access
- `data:text/html,<script>...` — Data URI attacks

**Any URL scheme is accepted.**

### The Fix

```javascript
const ALLOWED_DOMAINS = ['trusted-partner.com', 'app.yoursite.com'];

app.get('/redirect', (req, res) => {
  const url = new URL(req.query.to);
  if (!ALLOWED_DOMAINS.includes(url.hostname)) {
    return res.status(400).json({ error: 'Invalid redirect' });
  }
  res.redirect(url.toString());
});
```
