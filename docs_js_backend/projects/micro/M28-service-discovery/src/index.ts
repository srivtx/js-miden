import express, { Request, Response } from 'express';
import { registerService, getServices, updateHeartbeat } from './registry.js';

const app = express();
const PORT = process.env.DISCOVERY_PORT || 3000;

app.use(express.json());

app.post('/register', (req: Request, res: Response) => {
  const { name, url } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  const service = registerService(name, url);
  res.status(201).json(service);
});

app.get('/discover/:name', (req: Request, res: Response) => {
  const services = getServices(req.params.name);
  res.json(services);
});

app.post('/heartbeat/:id', (req: Request, res: Response) => {
  const success = updateHeartbeat(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Service not found' });
  }
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Service Discovery listening on port ${PORT}`);
  });
}

export { app };
