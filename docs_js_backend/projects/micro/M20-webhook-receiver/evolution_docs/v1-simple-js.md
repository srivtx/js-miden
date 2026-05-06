# M20 Webhook Receiver — v1 Simple JS

## The Naive Implementation

You need to receive webhooks from GitHub and Stripe. Simple:

```js
// app.js
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook/:provider', (req, res) => {
  const provider = req.params.provider;
  const payload = req.body;

  // Process the webhook
  processWebhook(provider, payload);

  res.json({ success: true });
});

function processWebhook(provider, payload) {
  console.log('Processing webhook from', provider, payload);
  // Do something important...
}

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/webhook/github \
  -H "Content-Type: application/json" \
  -d '{"action":"opened"}'
# → { "success": true }
```

## The Pain in Production

### 1. No Signature Verification

Anyone can POST to `/webhook/github`:
```bash
curl -X POST https://your-api.com/webhook/github \
  -d '{"action":"opened","issue":{"title":"You have been hacked"}}'
```

Your app processes forged webhooks. GitHub didn't send this. An attacker did. Without HMAC signature verification, you have no idea if the webhook came from the real provider.

### 2. Synchronous Processing

```js
function processWebhook(provider, payload) {
  // Heavy database writes, API calls, email sends...
  sendEmail(payload.user.email);
  updateDatabase(payload);
  callThirdPartyAPI(payload);
}
```

Your webhook handler waits for all of this before responding. GitHub times out after 10 seconds and retries. Stripe retries after 1 day if you don't respond quickly. You get duplicate processing, angry users, and data corruption.

### 3. No Replay Protection

An attacker captures a legitimate GitHub webhook and replays it:
```bash
# Same payload, same headers, sent 100 times
curl -X POST https://your-api.com/webhook/github -d '{"action":"opened",...}'
```

Your app processes it 100 times. 100 emails sent. 100 database writes. No deduplication.

### 4. No Idempotency

Stripe sends `invoice.paid` for invoice `inv_123`. Your server crashes mid-processing. Stripe retries. Your app processes `invoice.paid` again. The customer is charged twice. Or credited twice. Or emailed twice.

### 5. Error Leakage

```js
} catch (err) {
  res.status(500).json({ error: err.stack }); // Leaks internals!
}
```

Your error responses expose stack traces, file paths, and internal logic.

## The Lesson

Webhooks are untrusted by definition. Without signature verification, replay protection, and idempotency, you're building a public API that anyone can trigger. Without async processing, you're unreliable.

## What v2 Fixes

TypeScript. Stop passing `any` around as webhook payloads.
