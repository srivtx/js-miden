import express from 'express';
import { pipelineRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/pipeline', pipelineRouter);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { app };
