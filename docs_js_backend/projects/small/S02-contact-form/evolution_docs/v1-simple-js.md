# v1 — Simple JS (Naive Contact Form)

## The Scenario

It's 2am. Your junior built a contact form. "It just logs to console," they say. "Simple, right?"

## The PAIN: Zero Validation, Zero Protection

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  
  console.log('New contact:', { name, email, message });
  
  res.json({ success: true, message: 'Thanks!' });
});

app.listen(3000);
```

### What breaks in production:

1. **Any payload is accepted**: Empty name? Valid. `email: "lol"`? Valid. `message: ""`? Valid. You're logging nonsense and users think their message was sent.

2. **No spam protection**: A single `curl` loop sends 10,000 requests. Your console buffer overflows. Your logs are useless. Your server CPU is at 100% handling meaningless requests.

3. **No sanitization**: `message: "<script>alert('xss')</script>"` gets logged. If those logs ever render in an admin panel (they will), you've got stored XSS.

4. **No rate limiting**: Competitor bots your form. Your "contact us" becomes a DDoS vector.

5. **No types**: `req.body.emial` — typo in the client, `undefined` on the server, nobody notices until the sales team asks why no leads came in this week.

### The moment of realization:

> Junior: "Why are there 50,000 empty submissions in the logs?"
> 
> You: "Because we told the world we accept anything. And the world listened."

## Why we start here

Every contact form starts as a single endpoint that trusts the client. This version exists to teach the most important lesson in backend development: **the client is a hostile actor**. Even friendly users make mistakes. Bots don't.

## The fix (next version)

We need to know what shape the data should be before we can validate it. Time to add types.
