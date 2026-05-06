import express, { Request, Response } from 'express';
import { deviceRouter } from './device.js';
import { authenticateDevice, requireAuth } from './auth.js';
import { recordTelemetry, TelemetryPayload } from './telemetry.js';
import { checkAlerts } from './alert.js';
import { heartbeat } from './heartbeat.js';
import { createCommand, getPendingCommands, acknowledgeCommand } from './command.js';
import { storage } from './storage.js';

const app = express();
app.use(express.json());

// Device management (no auth required for registration)
app.use('/devices', deviceRouter);

// Telemetry ingestion (should require auth in production)
app.post('/telemetry', authenticateDevice, async (req: Request, res: Response) => {
  try {
    const body = req.body as TelemetryPayload;
    if (typeof body.temperature !== 'number' || typeof body.humidity !== 'number') {
      return res.status(400).json({ error: 'Temperature and humidity must be numbers' });
    }

    // BUG: No rate limiting. A malicious device could send 10,000 readings/sec
    // and overwhelm memory/storage, causing a DoS.
    const deviceId = req.headers['x-device-id'] as string;
    const payload: TelemetryPayload = { ...body, deviceId };
    const reading = await recordTelemetry(payload);
    const alerts = await checkAlerts(reading);

    res.status(201).json({ reading, alerts });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Heartbeat endpoint
app.post('/heartbeat', authenticateDevice, async (req: Request, res: Response) => {
  try {
    const deviceId = req.headers['x-device-id'] as string;
    const device = await heartbeat(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ status: 'ok', device });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Commands
app.post('/devices/:id/commands', async (req: Request, res: Response) => {
  try {
    const command = await createCommand(req.params.id, req.body.type, req.body.payload);
    res.status(201).json(command);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/devices/:id/commands/pending', async (req: Request, res: Response) => {
  const commands = await getPendingCommands(req.params.id);
  res.json(commands);
});

app.post('/commands/:id/acknowledge', async (req: Request, res: Response) => {
  const command = await acknowledgeCommand(req.params.id);
  if (!command) {
    return res.status(404).json({ error: 'Command not found' });
  }
  res.json(command);
});

// Alerts
app.get('/devices/:id/alerts', async (req: Request, res: Response) => {
  const alerts = await storage.getAlertsForDevice(req.params.id);
  res.json(alerts);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default app;

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`IoT Device Manager running on port ${PORT}`);
  });
}
