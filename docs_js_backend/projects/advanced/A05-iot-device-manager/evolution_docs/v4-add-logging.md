# v4 — Adding Logging

A device stops reporting. You have no idea when it last checked in. Was it 5 minutes ago? 5 hours? Your registry shows "online" but the last update was yesterday. The status is stale and you can't tell.

## The Fix: Structured Logging

You log every device event with timestamps.

```ts
import pino from 'pino';
const logger = pino();

app.post('/devices', (req, res) => {
  const device = req.body;
  logger.info({ deviceId: device.id, type: device.type }, 'Device registered');
  // ...
});

app.patch('/devices/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  logger.info({ deviceId: id, newStatus: status }, 'Device status updated');
  // ...
});

// Telemetry endpoint
app.post('/telemetry', (req, res) => {
  const { deviceId, temperature, batteryLevel } = req.body;
  logger.info({
    deviceId,
    temperature,
    batteryLevel,
  }, 'Telemetry received');
  // ...
});
```

Now you can query: "Show me all events for device `sensor-42` in the last hour."

## Why This Matters

Without logs, a silent device is a mystery. With structured logs, you can see the exact moment it stopped reporting and what its last known state was.

**Next:** Let's write tests so device state logic stays correct as you add real-time features.
