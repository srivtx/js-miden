import express from 'express';
import pollsRouter from './polls.js';

const app = express();
app.use(express.json());
app.use('/polls', pollsRouter);

export default app;
