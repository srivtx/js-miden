import { Router, Request, Response } from 'express';

export const router = Router();

router.get('/health', (req, res) => {
  const sync = req.app.locals.syncService;
  const storage = req.app.locals.storage;
  res.json({
    status: 'ok',
    peers: sync.getConnectedPeers().length,
    documents: storage.getDocumentCount(),
    tombstones: storage.getTombstoneCount(),
  });
});

router.get('/documents', (req, res) => {
  const storage = req.app.locals.storage;
  res.json({ documents: storage.getAllDocuments() });
});

router.get('/documents/:id', (req, res) => {
  const storage = req.app.locals.storage;
  const doc = storage.getDocument(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(doc);
});

router.post('/documents/:id', (req, res) => {
  const storage = req.app.locals.storage;
  const doc = {
    id: req.params.id,
    type: 'register' as const,
    data: req.body,
    vectorClock: { api: 1 },
    timestamp: Date.now(),
  };
  storage.storeDocument(doc);
  res.status(201).json(doc);
});

router.delete('/documents/:id', (req, res) => {
  const storage = req.app.locals.storage;
  storage.deleteDocument(req.params.id);
  res.status(204).send();
});

router.get('/presence', (req, res) => {
  const presence = req.app.locals.presenceService;
  res.json({ presence: presence.getAllPresence() });
});

router.get('/sync/peers', (req, res) => {
  const sync = req.app.locals.syncService;
  res.json({ peers: sync.getConnectedPeers() });
});

router.get('/conflicts', (req, res) => {
  const conflict = req.app.locals.conflictService;
  res.json({ mergeCount: conflict.getMergeCount() });
});