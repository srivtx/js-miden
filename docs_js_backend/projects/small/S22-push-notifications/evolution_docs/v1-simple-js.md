# S22 Push Notifications — v1 Simple JS

## The Naive Implementation

You need to send push notifications. Simple:

```js
// app.js
const express = require('express');
const app = express();

async function sendToFcm(token, title, body) {
  // Direct FCM API call
  await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { Authorization: 'key=YOUR_KEY' },
    body: JSON.stringify({ to: token, notification: { title, body } }),
  });
}

app.post('/send', async (req, res) => {
  const { token, title, body } = req.body;
  await sendToFcm(token, title, body);
  res.json({ status: 'sent' });
});

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"token":"abc123","title":"Hello","body":"World"}'
# → { "status": "sent" }
```

## The Pain in Production

### 1. Direct Send is Slow

FCM takes 50–200ms per request. Sending to 10,000 users means 10,000 sequential HTTP requests. That's 30+ minutes. Your HTTP client times out. The server restarts mid-send. Some users get notified, others don't.

### 2. No Token Validation

Invalid tokens (`short`, `expired`, `malformed`) are sent to FCM anyway. FCM rejects them. You waste API quota, bandwidth, and time. Worse, repeatedly sending to invalid tokens can get your sender ID blacklisted.

### 3. No Error Handling

FCM returns `InvalidRegistration`. Your code ignores it. The token stays in your database forever. You keep sending to it. Costs increase, delivery rates decrease.

### 4. No Queue

A burst of notifications (flash sale, breaking news) creates a thundering herd. Your server tries to send 50,000 notifications simultaneously. Memory exhaustion. Connection pool drained. Everything falls down.

### 5. No Delivery Tracking

You called FCM. Did the device receive it? Was it displayed? Did the user tap it? You have no insight. Your product team asks "How many saw the notification?" You can't answer.

## The Lesson

Direct push sending is fine for 10 users. At scale, you need batching, validation, error handling, queuing, and tracking.

## What v2 Fixes

TypeScript. Before we build a robust push service, let's get the types right.
