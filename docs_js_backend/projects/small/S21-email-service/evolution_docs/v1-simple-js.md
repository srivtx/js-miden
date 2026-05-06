# S21 Email Service — v1 Simple JS

## The Naive Implementation

You need to send emails. Simple:

```js
// app.js
const express = require('express');
const nodemailer = require('nodemailer');
const app = express();

const transporter = nodemailer.createTransport({
  host: 'smtp.example.com',
  port: 587,
});

app.post('/send', async (req, res) => {
  const { to, subject, body } = req.body;
  await transporter.sendMail({ to, subject, text: body });
  res.json({ status: 'sent' });
});

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"user@example.com","subject":"Hello","body":"World"}'
# → { "status": "sent" }
```

## The Pain in Production

### 1. Synchronous SMTP Blocks the Response

SMTP takes 200ms–5s per email. Your HTTP request hangs until the SMTP server responds. At 10 emails per second, your event loop is saturated. Other requests time out.

### 2. No Retry on Failure

The SMTP server returns a 4xx transient error (greylisting, rate limit). Your code throws. The user sees an error. The email is lost forever. A temporary blip becomes permanent data loss.

### 3. No Delivery Tracking

You sent the email. Did it arrive? Was it opened? Did it bounce? You have no idea. Your users complain they never got the password reset. You can't prove otherwise.

### 4. No Templates

Every email is constructed inline. Welcome emails, password resets, invoices — all hardcoded in route handlers. Marketing wants to update the welcome email copy. You deploy a code change.

### 5. No Queue

A burst of 1000 signups triggers 1000 concurrent SMTP connections. Your provider rate-limits you. Some emails fail, some succeed randomly. There's no backlog, no prioritization, no graceful degradation.

## The Lesson

Direct SMTP in a request handler is simple but fragile. Production email needs queuing, retries, templates, and tracking.

## What v2 Fixes

TypeScript. Before we build a robust email service, let's get the types right.
