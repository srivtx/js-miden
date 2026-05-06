import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

// Service proxies
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  tasks: process.env.TASK_SERVICE_URL || 'http://localhost:3002',
  notifications: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003',
  files: process.env.FILE_SERVICE_URL || 'http://localhost:3004',
};

app.use('/api/v1/auth', createProxyMiddleware({
  target: services.auth,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/auth': '' },
}));

app.use('/api/v1/tasks', createProxyMiddleware({
  target: services.tasks,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/tasks': '' },
}));

app.use('/api/v1/notifications', createProxyMiddleware({
  target: services.notifications,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/notifications': '' },
}));

app.use('/api/v1/files', createProxyMiddleware({
  target: services.files,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/files': '' },
}));

// Stripe webhooks bypass auth
app.use('/webhooks/stripe', createProxyMiddleware({
  target: services.auth,
  changeOrigin: true,
  pathRewrite: { '^/webhooks/stripe': '/webhooks/stripe' },
}));

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
