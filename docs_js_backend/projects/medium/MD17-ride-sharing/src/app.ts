import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { rideRoutes } from './routes/rides.js';
import { driverRoutes } from './routes/drivers.js';
import { riderRoutes } from './routes/riders.js';
import { reviewRoutes } from './routes/reviews.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/rides', rideRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/reviews', reviewRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`MD17 Ride Sharing API running on port ${PORT}`);
  });
}

export { app };
