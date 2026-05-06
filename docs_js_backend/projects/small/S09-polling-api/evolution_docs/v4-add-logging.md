# v4 — Adding Logging

A user emails you: "I voted but the count didn't change."

You check the database. The vote is there. The count is correct. You ask them to hard-refresh. It works. They were looking at a cached page.

But you wasted 20 minutes on this because you had no logs showing whether the vote was accepted, rejected, or what the client's IP was.

## The Fix: Structured Logging

```ts
import pino from 'pino';
const logger = pino();

app.post('/polls/:id/vote', (req, res) => {
  const ip = req.ip || 'unknown';
  logger.info({ pollId: req.params.id, optionId, ip }, 'Vote received');
  // ...
});
```

Now you can answer:
- "Did the vote register?" → Check logs.
- "Was it rejected as a duplicate?" → Check logs.
- "How many votes came from the same IP?" → Check logs.

## Real-Time Results

Users are still refreshing the page. You want live updates. You add Server-Sent Events (SSE).

```ts
router.get('/:id/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = () => {
    const options = db.prepare('SELECT id, text, count FROM options WHERE poll_id = ?').all(req.params.id);
    res.write(`data: ${JSON.stringify({ options })}\n\n`);
  };

  send();
  const interval = setInterval(send, 2000);

  req.on('close', () => clearInterval(interval));
});
```

Now browsers connect to `/polls/123/stream` and get updates every 2 seconds without refreshing.

## Connection Leaks

But wait. In some disconnect scenarios, `req.on('close')` never fires. You leak intervals. Over time, your server accumulates dead connections.

**Fix:** Add a heartbeat or timeout, and clean up aggressively.

**Next:** Let's write tests so the race condition doesn't come back.
