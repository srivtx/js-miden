import express from 'express';
import { hashRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/', hashRouter);

export { app };

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`M08 Password Hasher listening on port ${PORT}`);
  });
}
