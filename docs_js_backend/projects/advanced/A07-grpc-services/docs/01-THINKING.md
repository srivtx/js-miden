# Thinking Process

## Mental Models

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client     │────▶│  HTTP Gateway   │────▶│  User Service   │
│  (Browser)   │     │   (Express 5)   │     │   (gRPC :50051) │
└──────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Order Service  │
                       │   (gRPC :50052) │
                       └─────────────────┘
```

## The Hot Path
`POST /orders` → Gateway validates → gRPC to UserService (check user) → gRPC to OrderService (create order) → Return JSON. This must be < 100ms.

## The Danger Zone
1. **No Deadline**: OrderService hangs. Gateway thread pool exhausted. Cascade failure.
2. **No Retry**: Brief network blip fails the entire user request.
3. **Proto Mismatch**: Client sends `total_cents`, server expects `amount_cents`. Silent corruption.

## Question Everything
- Do we need REST at all? Yes — browsers and mobile can't speak gRPC easily (though gRPC-Web exists).
- Do we need a service mesh? Not for 2 services. At 20+ services, yes.
- Do we need streaming? Yes for `ListUsers` and `ListUserOrders` (large result sets).

## The "What If" Game
- What if UserService is down? Gateway should fail fast with a clear error.
- What if OrderService takes 30 seconds? Gateway must timeout and free the connection.
- What if we add a `currency` field to Order? Old clients must still work (backward compatibility).
