import express from 'express';
import { router } from './routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());

app.use(router);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
    detail: 'The requested resource does not exist',
    instance: _req.originalUrl,
  });
});

// Global error handler
app.use(errorHandler);

export default app;
