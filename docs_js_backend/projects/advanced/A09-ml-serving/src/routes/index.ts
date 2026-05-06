import { Router, Request, Response } from 'express';

export const router = Router();

router.get('/health', (req, res) => {
  const monitoring = req.app.locals.monitoringService;
  res.json(monitoring.getHealth());
});

router.post('/models', (req, res) => {
  const registry = req.app.locals.registry;
  const { name, version, path, metadata } = req.body;

  try {
    const model = registry.registerModel(name, version, path, metadata);
    res.status(201).json(model);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/models', (req, res) => {
  const registry = req.app.locals.registry;
  res.json({ models: registry.listModels() });
});

router.get('/models/:name', (req, res) => {
  const registry = req.app.locals.registry;
  const model = registry.getModel(req.params.name);
  if (!model) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }
  res.json(model);
});

router.get('/models/:name/versions', (req, res) => {
  const registry = req.app.locals.registry;
  const versions = registry.getAllVersions(req.params.name);
  res.json({ versions });
});

router.post('/models/:name/rollback', (req, res) => {
  const registry = req.app.locals.registry;
  const { version } = req.body;
  const success = registry.rollbackModel(req.params.name, version);
  if (!success) {
    res.status(400).json({ error: 'Rollback failed - version not found' });
    return;
  }
  res.json({ success: true, version });
});

router.post('/predict', async (req, res) => {
  const predictionService = req.app.locals.predictionService;
  try {
    const result = await predictionService.predict(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/predict/batch', async (req, res) => {
  const batchService = req.app.locals.batchService;
  try {
    const result = await batchService.predictBatch(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/metrics', (req, res) => {
  const monitoring = req.app.locals.monitoringService;
  res.json(monitoring.getAllMetrics());
});

router.get('/metrics/:modelName', (req, res) => {
  const monitoring = req.app.locals.monitoringService;
  const metrics = monitoring.getModelMetrics(req.params.modelName);
  if (!metrics) {
    res.status(404).json({ error: 'Model metrics not found' });
    return;
  }
  res.json(metrics);
});