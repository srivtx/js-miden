import express from 'express';
import expanderRouter from './expander.js';

const app = express();
app.use(express.json());
app.use('/expand', expanderRouter);

export default app;
