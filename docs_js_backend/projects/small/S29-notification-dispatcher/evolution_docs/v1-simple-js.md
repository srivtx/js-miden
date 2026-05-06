# v1-simple-js

## Goal
Send a notification directly via email with no abstraction.

## Code

```js
// src/index.js
const express = require('express');
const nodemailer = require('nodemailer');
const app = express();
app.use(express.json());

const transporter = nodemailer.createTransport({ host: 'smtp.example.com', port: 587 });

app.post('/notify', async (req, res) => {
  const { userId, message } = req.body;
  await transporter.sendMail({
    to: `${userId}@example.com`,
    subject: 'Notification',
    text: message,
  });
  res.json({ sent: true });
});

app.listen(3000, () => console.log('Dispatcher on 3000'));
```

## Decisions
- Direct `nodemailer` call — zero indirection.
- Hard-coded SMTP config — fastest to prototype.

## Risks
- No channel fallback — email down = notification lost.
- No templating — raw strings only.
- No user preferences — sends to everyone regardless of opt-out.
- No batching — 10k users = 10k SMTP connections.
