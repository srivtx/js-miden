import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { SyncService } from './services/SyncService.js';
import { PresenceService } from './services/PresenceService.js';
import { StorageService } from './services/StorageService.js';
import { ConflictResolutionService } from './services/ConflictResolutionService.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

const storage = new StorageService();
const conflictService = new ConflictResolutionService();
const syncService = new SyncService(storage, conflictService);
const presenceService = new PresenceService();

// Seed some test data
storage.storeDocument({
  id: 'doc-1',
  type: 'register',
  data: { title: 'Hello World', content: 'Initial content' },
  vectorClock: { server: 1 },
  timestamp: Date.now(),
});

app.locals.storage = storage;
app.locals.syncService = syncService;
app.locals.presenceService = presenceService;
app.locals.conflictService = conflictService;

app.use('/api', router);
app.use(errorHandler);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const peerId = url.searchParams.get('peerId') || `peer-${Date.now()}`;

  syncService.connectPeer(peerId, ws as any);
  presenceService.updatePresence({
    peerId,
    status: 'online',
    lastSeen: Date.now(),
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      syncService.handleMessage(peerId, message);
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    }
  });

  ws.on('close', () => {
    syncService.disconnectPeer(peerId);
    presenceService.updatePresence({
      peerId,
      status: 'offline',
      lastSeen: Date.now(),
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`DataSync CRDT Engine running on port ${PORT}`);
});

export { app, storage, syncService, presenceService, conflictService };