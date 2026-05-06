import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { mqttService } from './services/mqtt.service.js';
import deviceRoutes from './routes/device.routes.js';
import telemetryRoutes from './routes/telemetry.routes.js';
import commandRoutes from './routes/command.routes.js';
import alertRoutes from './routes/alert.routes.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

app.use('/api/devices', deviceRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/devices/:deviceId/commands', commandRoutes);
app.use('/api/alerts', alertRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Start MQTT bridge
mqttService.connect().catch((err) => {
  logger.error({ err }, 'Failed to connect to MQTT broker');
});

app.listen(config.port, () => {
  logger.info(`IoT platform server running on port ${config.port}`);
});

export default app;
