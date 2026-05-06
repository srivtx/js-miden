import express from 'express';
import notificationsRouter from './notifications.js';
import sseRouter from './sse.js';

const app = express();
app.use(express.json());
app.use('/notifications', notificationsRouter);
app.use('/notifications', sseRouter);

export default app;
