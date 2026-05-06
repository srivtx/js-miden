import express from 'express';
import routes from './routes.js';

const app = express();
app.use(express.json());
app.use('/messages', routes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Message service running on port ${PORT}`);
});

export default app;
