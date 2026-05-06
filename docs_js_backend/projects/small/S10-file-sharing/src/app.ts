import express from 'express';
import filesRouter from './files.js';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/files', filesRouter);

export default app;
