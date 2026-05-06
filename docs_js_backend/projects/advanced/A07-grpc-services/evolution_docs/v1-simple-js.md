# A07 Evolution: v1 — Simple JavaScript

## State of the System

The system begins as two plain Node.js HTTP servers speaking JSON over HTTP/1.1. There is no gateway, no schema, and no streaming. Services discover each other via hardcoded `localhost` ports.

## What Works

- `GET /users/:id` on the User Service returns a JSON user object from an in-memory object.
- `POST /orders` on the Order Service creates an order after `fetch()`ing the user service to validate existence.
- A third "API" file proxies browser requests to the two services using `node-fetch`.

## What Does NOT Work

- **No strong typing.** A rename from `total_cents` to `amount_cents` in one service silently breaks the other. The bug surfaces only in production when orders show `$0.00`.
- **No deadlines.** If the User Service hangs on a database lock, the Order Service waits forever. The event loop stalls; memory leaks accumulate.
- **Head-of-line blocking.** HTTP/1.1 keep-alive serializes requests. Two concurrent `POST /orders` calls reuse the same TCP connection and queue behind each other.
- **No streaming.** `GET /users` loads every user into memory before sending JSON. At 10,000 users, the process uses 400 MB and crashes with `RangeError`.

## Code Snapshot (user-service.js)

```javascript
const http = require('http');
const users = {};

http.createServer((req, res) => {
  if (req.url.startsWith('/users/')) {
    const id = req.url.split('/')[2];
    res.end(JSON.stringify(users[id] || { error: 'not found' }));
  }
}).listen(3001);
```

## Architectural Notes

This is the "REST JSON" stage. It is human-readable and easy to debug with `curl`, but it is catastrophically inefficient for service-to-service communication. Every request opens (or reuses) a TCP connection, sends text, and parses text. There is no schema enforcement — the "contract" between services is tribal knowledge.

## Migration Path to v2

1. Replace JSON-over-HTTP with gRPC + Protocol Buffers.
2. Introduce `.proto` files as the source of truth for the service contract.
3. Generate TypeScript interfaces from the proto so renames become compile-time errors.
