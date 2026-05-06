import express from 'express';
import { ModelRegistryService } from './services/ModelRegistryService.js';
import { PredictionService } from './services/PredictionService.js';
import { BatchService } from './services/BatchService.js';
import { MonitoringService } from './services/MonitoringService.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(express.json({ limit: '50mb' }));

const registry = new ModelRegistryService();
const predictionService = new PredictionService(registry);
const batchService = new BatchService(predictionService);
const monitoringService = new MonitoringService(predictionService, registry);

// Register a default model for testing
registry.registerModel('iris-classifier', '1.0.0', '/models/iris-v1', {
  inputShape: [4],
  outputShape: [3],
  framework: 'tensorflow',
  description: 'Iris flower classification model',
});

app.locals.registry = registry;
app.locals.predictionService = predictionService;
app.locals.batchService = batchService;
app.locals.monitoringService = monitoringService;

app.use('/api', router);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ML Model Serving API running on port ${PORT}`);
});

export { app, registry, predictionService, batchService, monitoringService };