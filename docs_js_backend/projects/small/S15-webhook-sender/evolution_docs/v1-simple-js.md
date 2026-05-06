# S15 Webhook Sender — v1 Simple JS

## The Naive Beginning

You need to send webhooks. The simplest thing: fire and forget.

```js
// server.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const webhooks = [];

app.post('/webhooks', (req, res) => {
  webhooks.push(req.body);
  res.status(201).json({ id: webhooks.length });
});

app.post('/events', async (req, res) => {
  for (const webhook of webhooks) {
    // Fire and forget — no error handling
    fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
  }
  res.json({ sent: webhooks.length });
});

app.listen(3000);
```

**"This works. Webhooks sent. Ship it."**

## The Pain in Production

### 1. Fire-and-Forget Failures

The receiver is down. The network hiccups. The request times out. Your server doesn't know. The webhook is lost forever. The client never gets notified.

### 2. No Retries

A transient 502 from the receiver means permanent data loss. Your system never tries again. The user wonders why their integration stopped working.

### 3. No Backoff

You retry immediately. The receiver is still recovering. You hammer it with 100 retries per second. You become the DDoS. The receiver blocks your IP.

### 4. No Delivery Logging

Support ticket: *"We didn't get the webhook."* You have no record of sending it. No record of the response. No record of retries. You're flying blind.

### 5. No Payload Verification

An attacker intercepts the webhook and modifies the payload. The receiver has no way to verify it came from you. Data integrity is compromised.

## What We Have

- **Fire-and-forget** — failures are silently lost
- **No retries** — transient errors become permanent
- **No backoff** — retries DDoS the receiver
- **No logging** — zero visibility into delivery
- **No signatures** — payload integrity is unverified

## What v2 Fixes

TypeScript. Before we solve reliability, let's stop type confusion from compiling.
