import express from 'express';
import { router } from './routes.js';

const app = express();
app.use(express.json());
app.use('/emails', router);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Email service running at http://localhost:${PORT}`);
});

export { app };
