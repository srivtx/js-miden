import express from 'express';
import weatherRouter from './routes/weather.js';

const app = express();
app.use(express.json());
app.use('/', weatherRouter);

export default app;
