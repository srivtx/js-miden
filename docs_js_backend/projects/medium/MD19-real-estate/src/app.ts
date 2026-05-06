import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { listingRoutes } from './routes/listings.js';
import { searchRoutes } from './routes/search.js';
import { tourRoutes } from './routes/tours.js';
import { agentRoutes } from './routes/agents.js';
import { calculatorRoutes } from './routes/calculator.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/listings', listingRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/tours', tourRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/calculator', calculatorRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`MD19 Real Estate API running on port ${PORT}`);
  });
}

export { app };
