import express from 'express';
import { ConfigManager } from './config-manager.js';

const app = express();
app.use(express.json());

const manager = new ConfigManager('./config.json');
await manager.load();

app.get('/config/:key', (req, res) => {
  const { key } = req.params;
  const value = manager.get(key);

  if (value === undefined) {
    res.status(404).json({ error: 'Config key not found' });
    return;
  }

  res.json({ key, value });
});

app.get('/config', (req, res) => {
  res.json(manager.getAll());
});

app.post('/config', async (req, res) => {
  const { key, value } = req.body;

  if (!key) {
    res.status(400).json({ error: 'Key is required' });
    return;
  }

  await manager.set(key, value);
  res.json({ key, value });
});

app.post('/config/bulk', async (req, res) => {
  await manager.setMultiple(req.body);
  res.json({ updated: Object.keys(req.body) });
});

export { app, manager };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Config manager service running on port ${PORT}`);
  });
}
