import express from 'express';
import { eventRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/events', eventRouter);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { app };
