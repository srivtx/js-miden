# HOW: Service Discovery

## How Service Discovery Works

### 1. Registration

A service sends a POST request with its name and URL:

```bash
POST /register
{ "name": "user-service", "url": "http://localhost:3001" }
```

The registry stores this with a unique ID and a `lastHeartbeat` timestamp:

```typescript
{
  id: "abc-123",
  name: "user-service",
  url: "http://localhost:3001",
  registeredAt: Date,
  lastHeartbeat: Date
}
```

### 2. Heartbeat

The service must send a POST to `/heartbeat/:id` every 10 seconds. This updates `lastHeartbeat`.

### 3. Cleanup (Intended)

Every 15 seconds, a cleanup job scans all registrations. Any service whose `lastHeartbeat` is older than 30 seconds is removed.

### 4. Discovery

A client requests `GET /discover/user-service`. The registry returns all non-expired instances:

```json
[
  { "id": "abc-123", "name": "user-service", "url": "http://localhost:3001" }
]
```

## File Breakdown

| File | Purpose |
|------|---------|
| `src/index.ts` | Express app, defines registration/discovery/heartbeat routes |
| `src/registry.ts` | In-memory store for service instances |
| `src/heartbeat.ts` | Cleanup logic for expired registrations |

## Running the Discovery Server

```bash
npm run dev

# Register a service
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"name":"user-service","url":"http://localhost:3001"}'

# Discover
curl http://localhost:3000/discover/user-service

# Heartbeat
curl -X POST http://localhost:3000/heartbeat/abc-123
```
