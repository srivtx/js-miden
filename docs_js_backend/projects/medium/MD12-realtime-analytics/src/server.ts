import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { config } from './config/index.js';
import { eventRouter } from './api/ingestion.js';
import { dashboardRouter } from './api/dashboard.js';

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/events', eventRouter);
app.use('/metrics', dashboardRouter);

app.listen(config.port, () => {
  console.log(`📊 Analytics server ready at http://localhost:${config.port}`);
});

export { app };