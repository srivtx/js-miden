# v4 — Add Logging

Your SaaS has validation, but when things break in production, you're blind. `console.log` scattered across 5 services tells you nothing about causality. A task update fails and you have no idea which user, which organization, or which service caused it.

## Pain #1: Silent Failures in Production

```typescript
// task/services/task.ts (before)
async updateTask(id: string, data: Partial<Task>, orgId: string) {
  try {
    return await Task.findOneAndUpdate({ _id: id, organizationId: orgId }, data, { new: true });
  } catch (error) {
    console.log('Error updating task', error);
    return null;
  }
}
```

A task update fails in production. The log says `"Error updating task"` with a stack trace. You don't know:
- Which user triggered it
- Which organization
- What the input data was
- Which service instance handled it
- The request trace ID

## Pain #2: No Cross-Service Correlation

The gateway logs `POST /api/v1/tasks/123`. The auth service logs `Token validated`. The task service logs `Error updating task`. None of these logs share a correlation ID. You can't reconstruct the request flow.

## Pain #3: Log Level Chaos

Every developer uses different formats:
- `console.log('task updated')`
- `console.error(err)`
- `console.debug('entering function')`

In production, you can't filter by severity. Error alerts fire on debug logs. Critical errors are buried in info noise.

## The Fix: Structured Logging with Pino

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: process.env.SERVICE_NAME || 'unknown',
    version: process.env.SERVICE_VERSION || '1.0.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['password', 'token', 'apiKey', 'req.headers.authorization'],
    remove: true,
  },
});

export function createRequestLogger(req: Request) {
  return logger.child({
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    userId: (req as any).user?.userId,
    organizationId: (req as any).user?.organizationId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
}
```

```typescript
// src/task/services/task.ts
import { logger } from '../../utils/logger.js';

export class TaskService {
  private log = logger.child({ component: 'TaskService' });

  async updateTask(id: string, data: Partial<Task>, orgId: string, userId: string) {
    const log = this.log.child({ taskId: id, organizationId: orgId, userId });
    log.info({ input: data }, 'Updating task');

    try {
      const task = await Task.findOneAndUpdate(
        { _id: id, organizationId: orgId },
        data,
        { new: true }
      );

      if (!task) {
        log.warn('Task not found or not in organization');
        return null;
      }

      log.info({ task }, 'Task updated successfully');
      return task;
    } catch (error: any) {
      log.error({ err: error, input: data }, 'Failed to update task');
      throw error;
    }
  }
}
```

## Log Output Example

```json
{
  "level": 30,
  "time": "2025-01-15T09:23:45.123Z",
  "pid": 12345,
  "hostname": "task-service-7f8a9b",
  "service": "task",
  "version": "1.2.3",
  "requestId": "req_abc123",
  "userId": "user_456",
  "organizationId": "org_789",
  "method": "PUT",
  "path": "/api/v1/tasks/task_123",
  "component": "TaskService",
  "taskId": "task_123",
  "msg": "Task updated successfully"
}
```

## Cross-Service Trace Propagation

```typescript
// gateway/src/index.ts
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  (req as any).requestId = requestId;
  next();
});

// Forward request ID to downstream services
async function proxyToService(req: Request, serviceUrl: string) {
  return fetch(serviceUrl, {
    headers: {
      'x-request-id': (req as any).requestId,
      'authorization': req.headers.authorization || '',
    },
  });
}
```

Now every log across gateway, auth, task, notification, and file services shares the same `requestId`. You can trace a single user action end-to-end.

## What Changed

| Before | After |
|--------|-------|
| `console.log('error')` | Structured JSON with context |
| No request correlation | `requestId` spans all services |
| Passwords in logs | Automatic redaction of sensitive fields |
| Can't filter by severity | Proper log levels (trace, debug, info, warn, error, fatal) |
| No service identification | Every log includes service name and version |

## Logging as Observability Foundation

Structured logs are the raw material for:
- **Alerting** — Error rate > 1% triggers PagerDuty
- **Dashboards** — Request latency by endpoint
- **Debugging** — Trace a single user's broken flow
- **Audit** — Who changed what, when

## Next Pain

Logging tells you what's broken, but it doesn't prevent regressions. A refactor breaks task creation and you only find out in production. You need automated testing.
