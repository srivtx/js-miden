import express from 'express';
import { searchRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/', searchRouter);

export { app };

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`M09 Query Parser listening on port ${PORT}`);
  });
}
