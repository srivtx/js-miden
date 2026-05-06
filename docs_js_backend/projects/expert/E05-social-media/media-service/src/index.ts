import express from 'express';
import routes from './routes.js';

const app = express();
app.use(express.json());
app.use('/media', routes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => {
  console.log(`Media service running on port ${PORT}`);
});

export default app;
