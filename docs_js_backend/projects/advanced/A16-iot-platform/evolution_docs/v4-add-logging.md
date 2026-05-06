# v4 — Add Logging (IoT Platform)

## The Scenario

It's 2am. A factory line is down. Your junior stares at the console: "The last thing I see is `IoT platform running on port 3000`. Then nothing." The maintenance team reports no telemetry from critical sensors. You check the logs. There are no logs. Just console output that vanished when the MQTT bridge restarted.

## The PAIN: Console.log Is Not Logging

From v3:

```typescript
app.post('/telemetry', async (req, res, next) => {
  try {
    const parsed = telemetrySchema.parse(req.body);
    const reading = await createTelemetryReading(parsed);
    console.log('Received telemetry:', reading.id); // <-- This is not logging
    res.status(201).json(reading);
  } catch (err) {
    console.error('Error:', err); // <-- This is also not logging
    next(err);
  }
});
```

### What breaks in production:

1. **No persistence**: `console.log` goes to stdout. Docker swallows it. Kubernetes rotates it. When the bridge restarts, logs are gone. You can't investigate the sensor outage.

2. **No context**: `"Error: [object Object]"` — you logged an Error object with console.log. The stack trace is gone. You can't debug the MQTT disconnect.

3. **No levels**: Every message is the same priority. A telemetry ingestion notification and a fatal crash look identical.

4. **No structure**: `"Received telemetry: abc123"` — good luck parsing that in your log aggregator. You need JSON for log aggregation.

5. **No request tracing**: A maintenance team asks "when did sensor-42 stop reporting?" You have no correlation ID. You have no timestamp history.

## The Solution: Structured Logging with Pino

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  // In production: output JSON for log aggregators
  // In dev: pretty print for humans
});
```

```typescript
// src/routes/telemetry.routes.ts
import { logger } from '../utils/logger.js';

app.post('/telemetry', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /telemetry', deviceId: req.body.deviceId });

  try {
    childLogger.info({ body: req.body }, 'Ingesting telemetry');
    const parsed = telemetrySchema.parse(req.body);

    const reading = await createTelemetryReading(parsed);
    childLogger.info({ readingId: reading.id, temperature: reading.temperature }, 'Telemetry ingested');

    res.status(201).json(reading);
  } catch (err) {
    childLogger.error({ err, body: req.body }, 'Failed to ingest telemetry');
    next(err);
  }
});
```

### Production log output:

```json
{
  "level": 30,
  "time": 1715000000000,
  "pid": 42,
  "hostname": "iot-bridge-pod-7f8d9",
  "requestId": "abc-123-def",
  "route": "POST /telemetry",
  "deviceId": "sensor-42",
  "readingId": "read-789",
  "temperature": 22.5,
  "msg": "Telemetry ingested"
}
```

### What structured logging gives you:

| Need | console.log | Pino |
|------|------------|------|
| Persist logs | ❌ Vanishes on restart | ✓ Writes to file/stdout (Docker/ELK captures) |
| Parse in log aggregator | ❌ String grep | ✓ JSON fields |
| Filter by level | ❌ All mixed | ✓ `level >= 40` for errors only |
| Trace requests | ❌ Manual grep | ✓ `requestId` correlation |
| Performance | ❌ Synchronous (blocks event loop) | ✓ Asynchronous (buffered) |

## The PAIN of Silent Failures

```typescript
// Without logging:
app.post('/commands', async (req, res) => {
  await sendCommand(req.body.deviceId, req.body.command);
  res.status(204).send();
  // Which command was sent? When? Was it acknowledged? You'll never know.
});

// With logging:
app.post('/commands', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /commands', deviceId: req.body.deviceId });

  try {
    childLogger.info({ command: req.body.command }, 'Sending command');
    const result = await sendCommand(req.body.deviceId, req.body.command);
    childLogger.info({ command: req.body.command, acknowledged: result.ack }, 'Command sent');
    res.status(204).send();
  } catch (err) {
    childLogger.error({ err, deviceId: req.body.deviceId }, 'Failed to send command');
    next(err);
  }
});
```

## Logging Evolution in the IoT Platform

| Version | Logging | Visibility |
|---------|---------|------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral, unstructured |
| v3 (Zod) | console.log | Same problems |
| v4 (Pino) | Structured, async, leveled | Full observability |

## The Realization

> Junior: "I added Pino and suddenly I can see exactly which sensor stopped reporting, what the last reading was, and the full error stack. In JSON."
>
> You: "Logs are your flight recorder. When a factory line goes down at 3am, logs are the only witness. Console.log is a Post-it note. Pino is a black box. In IoT, that black box connects the digital and physical worlds."

## The Next PAIN

Logging tells you what broke. But you find out **after** it breaks. What if we could catch regressions **before** deployment? What if we could prove the rules engine fires alerts when temperature exceeds thresholds?

## Next: v5 — Add Testing
