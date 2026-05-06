import express from 'express';
import { router } from './routes.js';

const app = express();
app.use(express.json());
app.use('/', router);

const PORT = process.env.PORT || 3000;
export const server = app.listen(PORT, () => {
  console.log(`S07 Blog API listening on ${PORT}`);
});

export { app };
