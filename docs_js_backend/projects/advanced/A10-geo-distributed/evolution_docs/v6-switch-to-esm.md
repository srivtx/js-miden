# A10 Evolution: v6 — Switch to ESM

## State of the System

The geo-distributed API is now a pure ES module package. Region configuration and peer lists are loaded dynamically, enabling the same Docker image to run in any region.

## What Changed

- **`"type": "module"` in package.json.** All `.js` and `.ts` files are ES modules.
- **`.js` extensions on all relative imports.** `import { StorageService } from './services/StorageService.js'`.
- **Dynamic imports for region config.** `const config = await import(`./config/${region}.js`);` loads region-specific settings (peer URLs, database endpoints) at startup.
- **Environment-driven region identity.** `process.env.REGION` and `process.env.REPLICAS` configure each instance without code changes.
- **`tsx` for development.** `tsx watch src/index.ts` runs the server in ESM mode.

## What Still Breaks

- **Last-write-wins is not fixed by ESM.** Conflict resolution still uses timestamps.
- **Replication loop is not fixed by ESM.** Records still bounce back and forth.
- **No persistence.** `StorageService` uses an in-memory Map. ESM enables dynamic import of Cassandra or DynamoDB clients, but none are configured.
- **No GeoDNS.** Routing is application-level. ESM does not change DNS resolution.

## Code Snapshot (src/index.ts)

```typescript
import express from 'express';
import { RoutingService } from './services/RoutingService.js';
import { StorageService } from './services/StorageService.js';
import { ReplicationService } from './services/ReplicationService.js';
import { ConflictResolutionService } from './services/ConflictResolutionService.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const region = process.env.REGION || 'us-east';
const replicas = (process.env.REPLICAS || '').split(',').filter(Boolean);

const app = express();
app.use(express.json());

const routingService = new RoutingService();
const storageService = new StorageService(region);
const replicationService = new ReplicationService(storageService);
const conflictService = new ConflictResolutionService();

for (const replica of replicas) {
  replicationService.addPeer(replica);
}
```

## Architectural Notes

This is the "ESM + multi-region" stage. ES modules enable the same codebase to run in any region with different environment variables. Dynamic imports allow region-specific extensions (e.g., EU GDPR compliance hooks) without bloating the base image. However, the core distributed systems bugs (LWW, loops, no persistence) remain unfixed.

## Migration Path to v7

1. Add Docker and docker-compose for multi-region deployment.
2. Replace in-memory storage with Cassandra or DynamoDB Global Tables.
3. Fix conflict resolution with CRDTs or application-level merge.
4. Add GeoDNS (Route 53 latency records) for automatic region routing.
5. Add mTLS between regions for replication security.
