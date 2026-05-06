import express from 'express';
import dotenv from 'dotenv';
import { flightRoutes } from './routes/flight.routes.js';
import { bookingRoutes } from './routes/booking.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/flights', flightRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'airline-reservation' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Airline reservation server running on port ${PORT}`);
});

export { app };
