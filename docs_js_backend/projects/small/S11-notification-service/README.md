# S11: Notification Service

## Overview
An API for in-app notifications with real-time unread counts via Server-Sent Events (SSE).

## Thinking Framework

### PHASE 1: Core Features
- `POST /notifications/notify` → creates a notification for a user.
- `GET /notifications?user_id=&page=&limit=` → list notifications with pagination.
- `PATCH /notifications/:id/read` → mark a notification as read.
- `GET /notifications/stream?user_id=` → SSE stream of unread count updates.

### PHASE 2: Design Decisions
- **Notification Aggregation**: Group similar events (e.g., 5 likes → "Alice and 4 others liked your post"). This requires an aggregation table keyed by `(user_id, type, reference_id)`.
- **Read Receipts**: Track when a user reads a notification. The `read` boolean is a simplified version; production systems may store `read_at`.
- **Notification Types**: `general`, `like`, `comment`, `mention`, `follow`. Different types trigger different UI templates and aggregation rules.

### PHASE 3: Architecture Decisions
- **SSE vs WebSockets**: SSE is chosen because notifications are server→client only. WebSockets are overkill for one-way push.
- **SQLite vs Redis**: SQLite is sufficient for an MVP. At scale, Redis sorted sets (by timestamp) provide O(log n) pagination and pub/sub for instant SSE fan-out.
- **Counter Storage**: A dedicated `users` table stores `unread_count` for fast reads. The alternative is `COUNT(*) WHERE read=0`, which becomes O(n) as notification volume grows.

### PHASE 4: Bugs & Hardening
- **Race condition in unread count**: Both the create and mark-read endpoints read the current `unread_count`, modify it in memory, and write it back. Under concurrency, this causes lost updates. The correct fix is an atomic `UPDATE users SET unread_count = unread_count + 1 WHERE id = ?`.
- **Missing aggregation**: Every notification creates a separate row. A high-activity user could receive thousands of "like" notifications for a single post.
- **No deduplication**: Identical notifications can be created repeatedly.

## Project Structure
```
src/
  db.ts            - SQLite schema (notifications, users)
  notifications.ts - POST /notify, GET /notifications, PATCH /read
  sse.ts           - SSE client registry and broadcast helper
  app.ts           - Express composition
  index.ts         - Server bootstrap
tests/
  notifications.test.ts - Vitest + Supertest suite
```

## Running
```bash
npm install
npm run dev     # tsx src/index.ts
npm test        # vitest run
```

## Example Requests
```bash
# Create notification
curl -X POST http://localhost:3000/notifications/notify \
  -H "Content-Type: application/json" \
  -d '{"user_id":"alice","title":"New follower","body":"Bob followed you"}'

# List notifications
curl "http://localhost:3000/notifications?user_id=alice&page=1&limit=10"

# Mark as read
curl -X PATCH http://localhost:3000/notifications/1/read

# SSE stream (in browser or with curl)
curl -N "http://localhost:3000/notifications/stream?user_id=alice"
```
