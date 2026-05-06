# Architecture: Load Balancer

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Load Balancer :3000                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │   Router    │  │  Round-Robin │  │   Health Checker    │ │
│  │             │  │   Selector   │  │   (every 5s)        │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
└────────────┬────────────────────────────────┬─────────────────┘
             │              │                 │
             ▼              ▼                 ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│  Backend 1      │ │ Backend 2   │ │  Backend 3      │
│    :3001        │ │   :3002     │ │    :3003        │
│  healthy: true  │ │ healthy: ?  │ │  healthy: true  │
└─────────────────┘ └─────────────┘ └─────────────────┘
```

## Data Flow

1. Client sends `GET /` to Load Balancer.
2. Router passes request to Round-Robin Selector.
3. Selector picks next backend in sequence.
4. Health Checker has previously marked all backends healthy/unhealthy.
5. Request is proxied to selected backend.
6. Response is returned to Client.

## State Management

- `counter`: integer tracking next backend index
- `backends[]`: array of backend objects with `url` and `healthy` flags
- Health check interval: `setInterval` running every 5 seconds

## Selection Algorithm

```
Request 1 → Backend 1 (counter = 0)
Request 2 → Backend 2 (counter = 1)
Request 3 → Backend 3 (counter = 2)
Request 4 → Backend 1 (counter = 3 % 3 = 0)
```
