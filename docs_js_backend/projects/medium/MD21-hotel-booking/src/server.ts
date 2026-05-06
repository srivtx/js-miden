import express from 'express';
import dotenv from 'dotenv';
import { roomRoutes } from './routes/room.routes.js';
import { bookingRoutes } from './routes/booking.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hotel-booking' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Hotel booking server running on port ${PORT}`);
});

export { app };
