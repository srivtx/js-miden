import express from 'express';
import helmet from 'helmet';
import { notificationRouter } from './routes.js';

const app = express();

app.use(helmet());
app.use(express.json());
app.use('/', notificationRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`S29 listening on ${PORT}`));
}

export { app };
