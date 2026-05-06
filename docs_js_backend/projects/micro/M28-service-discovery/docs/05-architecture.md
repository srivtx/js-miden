# Architecture: Service Discovery

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Service Discovery :3000                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Registration│  │   Discovery  │  │  Heartbeat Monitor  │ │
│  │   Handler   │  │    Handler   │  │   (every 15s)       │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
│                           │                                  │
│                    ┌──────┴──────┐                          │
│                    │  Registry   │                          │
│                    │  (in-mem)   │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
        ▲                                    ▲
        │ Register / Heartbeat               │ Discover
        │                                    │
┌───────┴───────┐                  ┌─────────┴─────────┐
│  Service A    │                  │    Service B      │
│  :3001        │                  │    :3002          │
└───────────────┘                  └───────────────────┘
```

## Data Flow

1. Service A starts and sends `POST /register` with name and URL.
2. Registration Handler stores the service in the Registry with a unique ID.
3. Service A sends `POST /heartbeat/:id` every 10 seconds.
4. Heartbeat Monitor scans the Registry every 15 seconds.
5. Services missing heartbeats for >30s are removed.
6. Service B sends `GET /discover/service-a`.
7. Discovery Handler returns only healthy instances.

## State Management

- `registry[]`: in-memory array of service objects
- Each entry has: `id`, `name`, `url`, `registeredAt`, `lastHeartbeat`
- Cleanup interval: `setInterval` running every 15 seconds
