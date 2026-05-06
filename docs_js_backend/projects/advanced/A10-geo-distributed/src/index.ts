import express from 'express';
import { RoutingService } from './services/RoutingService.js';
import { StorageService } from './services/StorageService.js';
import { ReplicationService } from './services/ReplicationService.js';
import { ConflictResolutionService } from './services/ConflictResolutionService.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(express.json());

const region = process.env.REGION || 'us-east';
const replicas = (process.env.REPLICAS || '').split(',').filter(Boolean);

const routingService = new RoutingService();
const storageService = new StorageService(region);
const replicationService = new ReplicationService(storageService);
const conflictService = new ConflictResolutionService();

for (const replica of replicas) {
  replicationService.addPeer(replica);
}

app.locals.region = region;
app.locals.routingService = routingService;
app.locals.storageService = storageService;
app.locals.replicationService = replicationService;
app.locals.conflictService = conflictService;

app.use('/api', router);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Geo-Distributed API (${region}) running on port ${PORT}`);
});

export { app, region, routingService, storageService, replicationService, conflictService };