import express from 'express';
import { experimentRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/experiments', experimentRouter);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { app };
