# A07 Evolution: v6 — Switch to ESM

## State of the System

The gRPC services and gateway are now pure ES modules. Proto files are loaded with `fileURLToPath(import.meta.url)`, and the `@grpc/grpc-js` client uses native ESM imports.

## What Changed

- **`"type": "module"` in package.json.** All `.js` and `.ts` files are ES modules.
- **`fileURLToPath(import.meta.url)` for `__dirname`.** `const __dirname = dirname(fileURLToPath(import.meta.url));` replaces CommonJS `__dirname`.
- **`.js` extensions on all relative imports.** `import { errorHandler } from '../middleware/errorHandler.js'`.
- **Dynamic proto loading.** `protoLoader.loadSync(join(__dirname, '../proto/user.proto'))` works because `__dirname` is computed from `import.meta.url`.
- **`tsx` for development.** `tsx watch src/gateway/index.ts` runs the gateway in ESM mode.

## What Still Breaks

- **Proto mismatch is not fixed by ESM.** Module boundaries are cleaner, but the gateway still loads `order_v1.proto` while the Order Service loads `order.proto`.
- **No deadlines or retries.** ESM enables dynamic import of retry utilities, but none are configured.
- **No mTLS.** `grpc.credentials.createInsecure()` is still used. ESM does not change transport security.
- **No health checks.** Kubernetes cannot determine if a gRPC service is ready.

## Code Snapshot (src/gateway/clients.ts)

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadProto(path: string) {
  const packageDefinition = protoLoader.loadSync(path, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  });
  return grpc.loadPackageDefinition(packageDefinition) as any;
}

const userProto = loadProto(join(__dirname, '../proto/user.proto'));
const orderProto = loadProto(join(__dirname, '../proto/order_v1.proto')); // BUG: still mismatched
```

## Architectural Notes

This is the "ESM + gRPC" stage. ES modules provide explicit dependency graphs and enable tree-shaking of unused proto definitions. The `closeClients()` function can be called on `SIGTERM` for graceful shutdown. However, the system still lacks production features: deadlines, retries, mTLS, health checks, and circuit breakers.

## Migration Path to v7

1. Add Docker and docker-compose for multi-service deployment.
2. Fix the proto mismatch by aligning all services to `order.proto` with `reserved` fields.
3. Add gRPC deadlines and retry policies via `grpc.service_config`.
4. Add mTLS with `grpc.credentials.createSsl()`.
5. Add health checks and a circuit breaker.
