import express from 'express';
import { queueRouter } from './routes.js';

const app = express();

app.use(express.json());
app.use('/', queueRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`S28 listening on ${PORT}`));
}

export { app };
