import express, { Request, Response } from 'express';
import { setConfig, getConfig } from './config.js';
import { validateConfig } from './validator.js';

const app = express();
const PORT = process.env.CONFIG_PORT || 3000;

app.use(express.json());

app.post('/config/:app/:env', (req: Request, res: Response) => {
  const { app: appName, env } = req.params;
  const config = req.body;

  // BUG: Validation is called but error is not handled properly
  const validation = validateConfig(config);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  setConfig(appName, env, config);
  res.json({ status: 'ok', app: appName, env });
});

app.get('/config/:app/:env', (req: Request, res: Response) => {
  const { app: appName, env } = req.params;
  const config = getConfig(appName, env);
  res.json(config);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Config Server listening on port ${PORT}`);
  });
}

export { app };
