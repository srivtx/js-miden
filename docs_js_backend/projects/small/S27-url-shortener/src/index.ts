import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { shortenerRouter } from './routes.js';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use('/', shortenerRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`S27 listening on ${PORT}`));
}

export { app };
