import express from 'express';
import { router } from './routes.js';

const app = express();
app.use(express.json());
app.use('/cart', router);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Shopping cart service running at http://localhost:${PORT}`);
});

export { app };
