import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { rateLimit } from './middleware/rate-limit.middleware.js';
import videoRoutes from './routes/video.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import streamRoutes from './routes/stream.routes.js';
import historyRoutes from './routes/history.routes.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit);

app.use('/api/videos', videoRoutes);
app.use('/api/videos', uploadRoutes);
app.use('/streams', streamRoutes);
app.use('/api/history', historyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`Video streaming server running on port ${config.port}`);
});

export default app;
