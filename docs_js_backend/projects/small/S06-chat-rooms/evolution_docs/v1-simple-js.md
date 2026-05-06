# v1 — Simple JS (Naive Chat)

## The Scenario

It's 2am. Your junior built a chat app. "It uses HTTP polling," they say. "Works everywhere!"

## The PAIN: Polling

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const messages = []; // All messages in a single array

app.post('/messages', (req, res) => {
  const { text } = req.body;
  messages.push({ id: messages.length + 1, text, time: Date.now() });
  res.status(201).send('OK');
});

app.get('/messages', (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const newMessages = messages.filter(m => m.id > since);
  res.json(newMessages);
});

app.listen(3000);
```

```javascript
// client.js (polling every second)
setInterval(async () => {
  const res = await fetch('/messages?since=' + lastId);
  const msgs = await res.json();
  msgs.forEach(displayMessage);
  if (msgs.length) lastId = msgs[msgs.length - 1].id;
}, 1000);
```

### What breaks in production:

1. **Battery drain**: Mobile clients wake up the radio every second. A user in your chat app for 10 minutes = 600 HTTP requests. Their phone dies by lunch.

2. **Server load**: 1,000 active users × 1 request/second = 1,000 RPS. For a chat app with 5 messages/minute. You're doing 12,000 requests to deliver 5 messages.

3. **Latency**: Message sent at T=0. Client polls at T=0.8s. Next poll at T=1.8s. Average latency: 500ms. It feels sluggish even when the server is fast.

4. **No rooms**: Everyone sees everything. Your "general" chat has 10,000 messages/hour. Your private team chat? Also visible to everyone. There are no rooms — just one global array.

5. **No persistence**: Restart the server? Chat history gone. Users see a blank screen and wonder what happened to their conversation.

### The moment of realization:

> Junior: "Why is the server at 80% CPU with only 50 users?"
> 
> You: "Because we're asking 'any new messages?' 50 times per second. The answer is usually no."

## Why we start here

Polling is the universal fallback. It works through firewalls, proxies, and ancient corporate networks. But it's the most expensive way to build real-time features. We start here to feel the cost — so we appreciate why WebSockets, SSE, and long-polling were invented.

## The fix (next version)

Before we can build real-time properly, we need to understand the data flowing through the system. Types first.
