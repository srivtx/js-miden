import express from 'express';
import cacheRoutes from './routes.js';

const app = express();
app.use(express.json());
app.use('/cache', cacheRoutes);

export default app;
