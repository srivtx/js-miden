import express from 'express';
import { MetricsCollector } from './metrics-collector.js';

const app = express();
app.use(express.json());

const collector = new MetricsCollector();

app.post('/metrics', (req, res) => {
  const { name, value, tags } = req.body;

  if (!name || typeof value !== 'number') {
    res.status(400).json({ error: 'Name and numeric value required' });
    return;
  }

  collector.record(name, value, tags || {});
  res.status(201).json({ recorded: true });
});

app.get('/metrics/:name', (req, res) => {
  const { name } = req.params;
  const windowMs = req.query.windowMs ? parseInt(req.query.windowMs as string) : undefined;
  const metrics = collector.getMetrics(name, windowMs);

  if (!metrics) {
    res.status(404).json({ error: 'No metrics found' });
    return;
  }

  res.json({ name, ...metrics });
});

app.get('/metrics', (req, res) => {
  const names = collector.getAllMetricNames();
  const all: Record<string, any> = {};
  for (const name of names) {
    all[name] = collector.getMetrics(name);
  }
  res.json({ metrics: all });
});

export { app, collector };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Metrics collector service running on port ${PORT}`);
  });
}
