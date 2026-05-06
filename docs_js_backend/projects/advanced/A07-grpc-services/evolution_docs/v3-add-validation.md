# A07 Evolution: v3 — Add Validation

## State of the System

The REST gateway now validates every JSON payload before translating it to gRPC. The proto mismatch bug is mitigated by runtime checks, and the gateway rejects impossible orders before they reach the Order Service.

## What Changed

- **Zod schemas for gateway routes.**
  - `createSchema` (users) — `email: z.string().email()`, `name: z.string().min(1)`.
  - `createSchema` (orders) — `user_id: z.string().min(1)`, `total_cents: z.number().int().positive()`, `items: z.array(z.object({ sku: z.string(), quantity: z.number().int().positive(), unit_price_cents: z.number().int().positive() }))`.
- **Email validation.** A malformed email is rejected with `VALIDATION_ERROR` before any gRPC call is made.
- **Positive integer enforcement.** `total_cents` must be a positive integer. Negative or fractional values are blocked at the boundary.
- **Error handler mapping.** `ZodError` → HTTP 400. gRPC `NOT_FOUND` → HTTP 404. gRPC `DEADLINE_EXCEEDED` → HTTP 504. All other gRPC errors → HTTP 500 with the original message.

## What Still Breaks

- **No deadlines on gRPC calls.** Validation happens fast, but the downstream gRPC call still hangs forever if the service is unresponsive.
- **No retry logic.** A transient `UNAVAILABLE` during a rolling deploy returns 500 to the client, even though the service recovers within 2 seconds.
- **Proto version mismatch persists.** The gateway loads `order_v1.proto` and sends `total_cents`. The Order Service loads `order.proto` and reads `amount_cents`. Zod validates the JSON shape, but it cannot detect the proto field name divergence.
- **No request ID propagation.** A validation error in the gateway is logged locally, but there is no trace ID to correlate it with the corresponding client request.

## Code Snapshot (gateway/routes/orders.ts)

```typescript
const createSchema = z.object({
  user_id: z.string().min(1),
  total_cents: z.string().or(z.number()).transform((v) => Number(v)),
  items: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().int(),
      unit_price_cents: z.number().int(),
    })
  ).default([]),
});

router.post('/', (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    // ... gRPC call
  } catch (err) {
    next(err);
  }
});
```

## Architectural Notes

This is the "protobuf + validation" stage. The gateway now acts as a semantic firewall: it enforces that `total_cents` is a positive number and that `items` is an array of well-formed objects. However, the gateway-to-service contract is still vulnerable to proto evolution bugs. Runtime validation at the JSON boundary cannot protect against binary protobuf mismatches.

## Migration Path to v4

1. Add structured logging with request ID injection into gRPC metadata.
2. Fix the proto mismatch by aligning gateway and service proto files and adding `reserved` for deleted fields.
3. Introduce gRPC deadlines and retry policies via `grpc.service_config`.
