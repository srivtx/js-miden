# v4 — Adding Logging

A user reports they didn't get a notification. You check the database. The notification is there. They insist they didn't see it.

After 30 minutes of back-and-forth, you realize they *did* get it, but their frontend had a bug that hid notifications of type `mention`. If you had logs, you'd have seen the delivery and saved half an hour.

## The Fix: Structured Logging

```ts
import pino from 'pino';
const logger = pino();

app.post('/notify', (req, res) => {
  logger.info({ user_id, type, title }, 'Notification created');
});

// When broadcasting via SSE
logger.info({ user_id, clientCount }, 'Unread count broadcasted');
```

Now you can trace the full lifecycle:
1. Notification created
2. Unread count incremented
3. SSE broadcast sent
4. Client acknowledged (or didn't)

## Real-Time Delivery

Users are polling `/notifications` every 5 seconds. Your database is doing `COUNT(*) WHERE read=0` constantly. It's wasteful.

You add Server-Sent Events (SSE).

```ts
const clients = new Map<string, Set<Response>>();

export function broadcastUnreadCount(userId: string, count: number) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const data = JSON.stringify({ user_id: userId, unread_count: count });
  for (const client of userClients) {
    client.write(`data: ${data}\n\n`);
  }
}
```

Clients connect to `/notifications/stream` and get instant updates when their unread count changes.

## Connection Management

But SSE connections can leak. You need proper cleanup.

```ts
req.on('close', () => {
  clients.get(user_id)?.delete(res);
  if (clients.get(user_id)?.size === 0) clients.delete(user_id);
});
```

**Next:** Let's write tests so the race condition doesn't regress.
