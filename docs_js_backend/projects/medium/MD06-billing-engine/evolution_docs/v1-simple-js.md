# MD06 Billing Engine — v1 Simple JS

> **Motto**: Before you handle money, handle the request.

## What We Built

A plain Node.js HTTP server with zero framework. One endpoint: `POST /charge` that creates a Stripe PaymentIntent and returns the client secret. No database. No sessions. No auth.

## Why Start Here

- **Speed**: Get a charge working in 20 lines
- **Clarity**: See exactly what Stripe needs without Express middleware magic
- **Baseline**: Every later abstraction (framework, types, validation) must earn its keep

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Node.js HTTP   │─────▶│     Stripe      │
│  (Checkout) │◀─────│  (bare bones)   │◀─────│   API           │
└─────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```javascript
// server.js
const http = require('http');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const server = http.createServer(async (req, res) => {
  if (req.url === '/charge' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const { amount, currency = 'usd' } = JSON.parse(body);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ clientSecret: paymentIntent.client_secret }));
    });
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(3000, () => console.log('Billing v1 on :3000'));
```

## Problems We Accepted

- No input validation — `amount` could be negative or a string
- No error handling — Stripe network errors crash the process
- No idempotency — retrying the request creates duplicate PaymentIntents
- No logging — when something breaks, we have zero visibility
- No tests — we hope it works

## Checklist

- [ ] Stripe secret key is loaded from `process.env`
- [ ] JSON body is parsed manually (no `express.json()` yet)
- [ ] No cardholder data (PAN, CVV) ever touches our server
- [ ] PaymentIntent is created with the exact amount passed by the client

## Next Step

Add TypeScript so we stop guessing what `amount` is.
