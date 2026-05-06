import express from 'express';
import { createLogger } from 'pino';
import { requestLogger } from './middleware/logger.js';

export function createApp() {
  const app = express();

  const logger = createLogger({
    name: 'hello-api',
    level: process.env.LOG_LEVEL || 'info',
  });

  // Register structured logging middleware
  app.use(requestLogger(logger));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Main greeting endpoint
  app.get('/', (_req, res) => {
    res.send('Hello, World!');
  });

  return app;
}
