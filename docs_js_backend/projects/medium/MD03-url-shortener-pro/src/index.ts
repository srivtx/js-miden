import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectRedis } from './redis.js';
import { rateLimitRedirect } from './middleware/rateLimiter.js';
import * as urlService from './services/urlService.js';
import * as analyticsService from './services/analyticsService.js';
import urlRoutes from './routes/url.js';
import adminRoutes from './routes/admin.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Redirect endpoint - high traffic, separate rate limit
app.get('/:shortCode', rateLimitRedirect, async (req, res, next) => {
  try {
    const originalUrl = await urlService.getOriginalUrl(req.params.shortCode);
    if (!originalUrl) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Short URL not found' } });
    }

    // Track click asynchronously without awaiting to not block redirect
    analyticsService.trackClick({
      urlId: req.params.shortCode,
      ipAddress: req.ip || undefined,
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer,
      country: req.headers['cf-ipcountry'] as string | undefined,
    }).catch(console.error);

    return res.redirect(301, originalUrl);
  } catch (err) {
    next(err);
  }
});

app.use('/urls', urlRoutes);
app.use('/admin', adminRoutes);

app.use(errorHandler);

async function main() {
  await connectRedis();
  console.log('Connected to Redis');

  const server = app.listen(config.port, () => {
    console.log(`MD03 URL Shortener API running on port ${config.port}`);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      process.exit(0);
    });
  });
}

main().catch(console.error);

export { app };
