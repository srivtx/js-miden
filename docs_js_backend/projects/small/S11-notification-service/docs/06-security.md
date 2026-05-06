# S11 Notification Service — Security

## Race Condition Abuse

An attacker can exploit the read-modify-write race to manipulate unread counts:
- Rapidly create notifications while marking others as read.
- The count may drift negative or under-report, confusing the user and potentially hiding malicious activity.

### Fix
Use atomic increments and decrements:
```sql
UPDATE users SET unread_count = unread_count + 1 WHERE id = ?;
UPDATE users SET unread_count = unread_count - 1 WHERE id = ? AND unread_count > 0;
```

## SSE Stream Abuse

The SSE endpoint is unauthenticated:
- An attacker can open thousands of connections, exhausting memory and file descriptors.
- Each connection holds an open TCP socket and a Response object.

### Mitigations
1. **Authenticate**: Require a session cookie or token to open the stream.
2. **Connection limits**: Reject new connections after N active streams per user.
3. **Heartbeat timeouts**: Close idle connections after 30 seconds of inactivity.

## Notification Injection

There is no authorization check on `POST /notify`. Any client can send notifications to any user:
```bash
curl -X POST /notify -d '{"user_id":"victim","title":"You won","body":"Click here"}'
```

### Fix
Require an authenticated service account or signed JWT to create notifications.

## Information Leakage via Pagination

If user A guesses user B's `user_id`, they can read B's notifications. Use authenticated sessions and scope all queries to the current user.

## Denial of Service

- **No pagination limit**: A user with 10,000 notifications requesting `limit=99999` causes a full table scan.
  - **Fix**: Enforce a maximum limit (e.g., 100).
- **Notification spam**: An attacker creates millions of notifications for a victim.
  - **Fix**: Rate limiting on creation per sender/recipient pair.
