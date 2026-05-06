import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { shipmentRoutes } from './routes/shipments.js';
import { trackingRoutes } from './routes/tracking.js';
import { warehouseRoutes } from './routes/warehouses.js';
import { routeRoutes } from './routes/routes.js';
import { inventoryRoutes } from './routes/inventory.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/shipments', shipmentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/inventory', inventoryRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`MD20 Logistics API running on port ${PORT}`);
  });
}

export { app };
