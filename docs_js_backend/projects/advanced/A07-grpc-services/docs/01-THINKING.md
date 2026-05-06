# Thinking Process

## Mental Models

Think of gRPC not as "REST with binary" but as **procedure calls over a persistent, multiplexed wire**:

```
HTTP/1.1 REST Model (2010s):
  Client ──TCP──► Server
  GET /users/123    ──► Process ──► Response
  GET /users/124    ──► New TCP ──► Response
  POST /orders      ──► New TCP ──► Response

HTTP/2 gRPC Model (2025):
  Client ────────One TCP Connection────────► Server
  Stream 1: GetUser({id:123})     ──► Response
  Stream 2: CreateOrder({...})    ──► Response
  Stream 3: ListUsers(stream)     ──► User, User, User...
  Stream 4: ListUserOrders(...)   ──► Order, Order...
```

A single HTTP/2 connection carries many independent bidirectional streams. gRPC maps each RPC to one stream.

## The Hot Path

`POST /orders` is the most critical user-facing flow:

```
Browser ──REST──► Gateway ──gRPC 5ms──► UserService.GetUser (validate user exists)
                       │
                       └──gRPC 8ms──► OrderService.CreateOrder (persist order)
                       │
                       ◄──JSON 2ms──┘
```

**Target SLA**: < 100ms end-to-end. Without deadlines, one slow service breaks the SLA for everyone.

## The Danger Zone

1. **No Deadline**: OrderService hangs on a database lock. Gateway thread pool exhausted. HTTP clients timeout after 30s while gRPC calls leak file descriptors forever.
2. **No Retry**: A 50ms network blip during a rolling deployment fails the entire user request. Users see 500 errors for transient failures.
3. **Proto Mismatch**: Gateway sends `total_cents` (v1). Server expects `amount_cents` (v2). gRPC silently ignores unknown fields. Orders are created with `amount_cents = 0`. Revenue loss, data corruption, no error logs.

## Question Everything

- **Do we need REST at all?** Yes — browsers and most mobile clients cannot speak gRPC natively (gRPC-Web exists but requires an Envoy proxy). The gateway is the translation layer.
- **Do we need a service mesh?** Not for 2 services. At 20+ services, the operational overhead of per-service retry/deadline config justifies Istio/Linkerd.
- **Do we need streaming?** Yes. `ListUsers` and `ListUserOrders` can return thousands of rows. Server-streaming avoids loading everything into memory at once and gives backpressure via HTTP/2 flow control.
- **Why not GraphQL?** GraphQL is great for client-driven queries but adds N+1 query risk and serialization overhead for internal service chatter.

## The "What If" Game

- **What if UserService is down?** Gateway should fail fast with `grpc.status.UNAVAILABLE` mapped to HTTP 503. The client can retry with its own backoff.
- **What if OrderService takes 30 seconds?** Gateway must timeout at 5 seconds and free the HTTP/2 stream. Return HTTP 504 Gateway Timeout.
- **What if we add a `currency` field to Order?** Old clients must still work. Use a new field number (`int32 currency = 7;`). Never reuse or rename existing numbers.
- **What if we need to deploy OrderService v2?** Run both versions behind a load balancer. Use proto `reserved` to prevent accidental field reuse.
