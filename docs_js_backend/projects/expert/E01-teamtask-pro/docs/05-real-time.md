# Real-Time Updates with SSE

## Overview
The Notification Service provides real-time updates via Server-Sent Events (SSE). Clients maintain a persistent HTTP connection to receive instant updates.

## Architecture

```
┌─────────┐     SSE Connection      ┌─────────────────┐
│ Client  │ ◄─────────────────────► │ Notification    │
│ (Web)   │                         │ Service (3003)  │
└─────────┘                         └────────┬────────┘
                                             │
                              Redis Pub/Sub ◄┘►
                                             │
                                    ┌────────┴────────┐
                                    │  Task Service   │
                                    │  (publishes)    │
                                    └─────────────────┘
```

## Connection Flow

1. Client opens SSE connection:
   ```
   GET /api/v1/notifications/events?token=<jwt>&org=<orgId>
   ```

2. Server validates JWT and establishes SSE stream

3. Server sends heartbeat every 30 seconds

4. When events occur, services publish to Redis:
   ```json
   {
     "organizationId": "org123",
     "event": "task.updated",
     "data": { "taskId": "task456", "status": "done" }
   }
   ```

5. Notification service broadcasts to connected clients

## Event Types
| Event | Description |
|-------|-------------|
| `task.created` | New task created |
| `task.updated` | Task modified |
| `task.assigned` | Task assigned to user |
| `project.created` | New project created |
| `file.uploaded` | File attached to task |

## Horizontal Scaling
Redis pub/sub enables multiple notification service instances:
- Each instance maintains local SSE connections
- All instances subscribe to Redis channel
- Events published once, delivered to all relevant clients

## Known Vulnerability
The notification service broadcasts events to **ALL** connections without filtering by `organizationId`. This means clients receive real-time updates from other organizations.

See `07-security.md` for details.
