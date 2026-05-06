# v1 — The Naive Notification Service (Pure JS)

You want notifications in your app. "Someone liked your post." You build it quickly.

```js
const express = require('express');
const app = express();

const notifications = {}; // userId -> array of messages

app.post('/notify', (req, res) => {
  const { user_id, message } = req.body;
  if (!notifications[user_id]) notifications[user_id] = [];
  notifications[user_id].push({ message, read: false, time: Date.now() });
  res.status(201).json({ success: true });
});

app.get('/notifications', (req, res) => {
  res.json(notifications[req.query.user_id] || []);
});

app.listen(3000);
```

In-memory. Simple. Fast.

## Then the Pain Hits

**The server restarts.** All notifications vanish. Users who had 50 unread messages now have zero. They think someone cleared their inbox.

**No unread counts.** Your frontend has to count `filter(n => !n.read).length` on every page load. With 10,000 notifications, that's slow.

**Duplicate spam.** A popular post gets 500 likes. The author gets 500 separate notifications. Their phone vibrates for 5 minutes straight.

## The Realization

You need:
1. **Persistence** — memory is not a database
2. **Unread counts** — fast, cached counters
3. **Aggregation** — "Alice and 499 others liked your post"
4. **Real-time delivery** — push to clients without polling

This is where the evolution starts.
