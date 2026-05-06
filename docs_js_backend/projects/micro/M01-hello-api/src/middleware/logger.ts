import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';

/**
 * Express middleware that logs every HTTP request as structured JSON.
 *
 * PHASE 2 Context:
 * - console.log blocks the event loop; Pino writes asynchronously.
 * - Structured JSON can be parsed by Datadog, Splunk, ELK, etc.
 * - Response time tells us if handlers are slow.
 *
 * PHASE 3 Decision:
 * - Use Pino (fastest Node logger, zero overhead in production).
 * - Hook into res 'finish' event so we know the final status code.
 * - Include a requestId for distributed tracing.
 */
export function requestLogger(logger: Logger) {
  // BUG (PHASE 5): startTime is captured once when this middleware factory runs,
  // NOT once per request. This means durationMs becomes the time since the
  // middleware was created (e.g. server boot), not the actual request time.
  const startTime = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();

    // Attach requestId for correlation across logs
    (req as Request & { id: string }).id = requestId;

    // Wait until the response is fully sent before logging
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;

      logger.info({
        requestId,
        method: req.method,
        path: req.url,
        statusCode: res.statusCode,
        durationMs,
        timestamp: new Date().toISOString(),
      }, 'request completed');
    });

    next();
  };
}
