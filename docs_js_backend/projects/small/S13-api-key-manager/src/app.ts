import express from 'express';
import keysRouter from './keys.js';
import { authMiddleware } from './middleware.js';

const app = express();
app.use(express.json());
app.use('/keys', keysRouter);
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Access granted' });
});

export default app;
