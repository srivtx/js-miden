import { Router, Request, Response } from 'express';

export const router = Router();

router.get('/health', (req, res) => {
  const region = req.app.locals.region;
  const replication = req.app.locals.replicationService;
  res.json({
    status: 'ok',
    region,
    peers: replication.getPeerCount(),
  });
});

router.get('/route/:userId', (req, res) => {
  const routing = req.app.locals.routingService;
  const region = routing.routeUser(req.params.userId, req.query.region as string);
  res.json({ userId: req.params.userId, region });
});

router.post('/data/:id', (req, res) => {
  const storage = req.app.locals.storageService;
  const replication = req.app.locals.replicationService;

  const record = storage.update(req.params.id, req.body.value);
  replication.replicate(record);

  res.json(record);
});

router.get('/data/:id', (req, res) => {
  const storage = req.app.locals.storageService;
  const record = storage.get(req.params.id);
  if (!record) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(record);
});

router.post('/replicate', (req, res) => {
  const replication = req.app.locals.replicationService;
  const result = replication.receiveReplication(req.body);
  res.json(result);
});

router.post('/conflict/resolve', (req, res) => {
  const conflict = req.app.locals.conflictService;
  const { local, remote } = req.body;
  const result = conflict.resolveConflict(local, remote);
  res.json(result);
});

router.get('/conflicts', (req, res) => {
  const conflict = req.app.locals.conflictService;
  res.json({
    count: conflict.getConflictCount(),
    conflicts: conflict.getConflicts(),
  });
});

router.get('/data', (req, res) => {
  const storage = req.app.locals.storageService;
  res.json(storage.getAll());
});