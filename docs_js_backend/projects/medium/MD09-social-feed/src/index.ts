import express from 'express';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { postsRouter } from './routes/posts.js';
import { usersRouter } from './routes/users.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/api/users', usersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MD09 Social Feed running on port ${PORT}`);
});

export { app };
