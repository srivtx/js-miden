import express from 'express';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/', authRouter);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`M07 server running on http://localhost:${PORT}`);
  });
}

export default app;
