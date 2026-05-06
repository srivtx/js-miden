import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import metricsRouter from './routes/metrics.js';
import alertsRouter from './routes/alerts.js';
import dashboardRouter from './routes/dashboard.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/metrics', metricsRouter);
app.use('/alerts', alertsRouter);
app.use('/dashboard', dashboardRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Monitoring API running on port ${PORT}`);
});
