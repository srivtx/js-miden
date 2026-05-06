# Architecture: API Gateway Basics

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway :3000                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │   Logger    │  │ Request ID   │  │    Proxy Router     │ │
│  │ Middleware  │  │  Middleware  │  │  /users → :3001     │ │
│  │             │  │              │  │  /orders → :3002    │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
└────────────┬────────────────────────────────┬─────────────────┘
             │                                │
             ▼                                ▼
┌─────────────────────┐            ┌─────────────────────┐
│   User Service      │            │   Order Service     │
│      :3001          │            │      :3002          │
└─────────────────────┘            └─────────────────────┘
```

## Data Flow

1. Client sends `GET /users/profile` to Gateway.
2. Logger middleware records `GET /users/profile`.
3. Request ID middleware generates `X-Request-ID: abc-123`.
4. Proxy Router matches `/users/*` → `http://localhost:3001`.
5. Gateway forwards request with all headers including `X-Request-ID`.
6. User Service processes request and returns response.
7. Gateway pipes response back to Client with `X-Request-ID`.

## State Management

The gateway is stateless. No session data is stored. Request IDs are generated per-request and are not persisted.

## Error Handling (Current vs Intended)

| Scenario | Current | Intended |
|----------|---------|----------|
| Backend down | Crash or hang | 502 Bad Gateway |
| Backend slow | Hang forever | 504 Gateway Timeout |
| Unknown route | 404 | 404 |
