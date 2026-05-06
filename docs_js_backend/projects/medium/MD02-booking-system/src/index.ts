import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import resourceRoutes from './routes/resources.js';
import bookingRoutes from './routes/bookings.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/resources', resourceRoutes);
app.use('/bookings', bookingRoutes);

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`MD02 Booking System API running on port ${config.port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

export { app };
