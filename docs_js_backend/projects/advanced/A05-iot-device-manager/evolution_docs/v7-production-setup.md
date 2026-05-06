# v7 — Production Setup (MQTT + Telemetry + Commands + Alerting)

Your IoT registry works. But it's HTTP polling. Devices hammer your server. You have no telemetry pipeline, no command channel, and no alerting. At scale, this is unusable.

---

## Architecture Evolution: HTTP Polling → MQTT + Services

```
HTTP Polling (v1-v5)
    ↓
MQTT + Multi-Service (v7)
    ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Device    │────▶│    MQTT     │────▶│  Telemetry  │
│  (Sensor)   │     │   Broker    │     │  Ingestion  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────┴────┐       ┌────┴────┐       ┌────┴────┐
   │Registry │       │Command  │       │Alerting │
   │ Service │       │Dispatch │       │ Service │
   └─────────┘       └─────────┘       └─────────┘
```

---

## Pain #1: HTTP Polling Doesn't Scale

10,000 devices polling every 5 seconds = 2,000 requests per second. 90% of them return "no change". Your server wastes resources.

**Fix:** MQTT for push-based communication.

```ts
// device-firmware (pseudocode)
// Publishes instead of polling
client.publish('devices/sensor-01/telemetry', JSON.stringify({
  temperature: 22.5,
  humidity: 45,
  batteryLevel: 87,
}));
```

```ts
// telemetry-ingestion-service/src/index.ts
import mqtt from 'mqtt';
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const client = mqtt.connect(process.env.MQTT_BROKER_URL);

client.on('connect', () => {
  client.subscribe('devices/+/telemetry');
});

client.on('message', async (topic, message) => {
  const deviceId = topic.split('/')[1];
  const payload = JSON.parse(message.toString());

  logger.info({ deviceId, ...payload }, 'Telemetry received');

  await db.query(
    `INSERT INTO telemetry (device_id, temperature, humidity, battery_level, received_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [deviceId, payload.temperature, payload.humidity, payload.batteryLevel]
  );

  // Update last seen
  await db.query(
    `UPDATE devices SET last_seen = NOW() WHERE id = $1`,
    [deviceId]
  );
});
```

Devices publish when they have data. The ingestion service subscribes. No polling. No wasted requests.

---

## Pain #2: No Command Channel

A device is misbehaving. You want to reboot it. You have no way to send it a message.

**Fix:** Command dispatch via MQTT.

```ts
// command-service/src/index.ts
import mqtt from 'mqtt';
const client = mqtt.connect(process.env.MQTT_BROKER_URL);

interface Command {
  deviceId: string;
  type: 'reboot' | 'updateConfig' | 'calibrate';
  payload: unknown;
  issuedAt: Date;
}

app.post('/commands', async (req, res) => {
  const command: Command = req.body;

  // Persist command
  await db.insertInto('commands').values({
    device_id: command.deviceId,
    type: command.type,
    payload: JSON.stringify(command.payload),
    status: 'pending',
    issued_at: command.issuedAt,
  }).execute();

  // Publish to device-specific topic
  const topic = `devices/${command.deviceId}/commands`;
  client.publish(topic, JSON.stringify(command));

  logger.info({ deviceId: command.deviceId, type: command.type }, 'Command dispatched');
  res.json({ status: 'dispatched' });
});
```

```ts
// device-firmware (pseudocode)
client.subscribe(`devices/${deviceId}/commands`);
client.on('message', (topic, message) => {
  const command = JSON.parse(message.toString());
  if (command.type === 'reboot') {
    system.reboot();
  }
});
```

Commands are persistent (in DB) and delivered (via MQTT). Even if the device is offline, the command is queued by the MQTT broker with QoS 1.

---

## Pain #3: Devices Fail Silently

A temperature sensor stops reporting. You don't know for 24 hours when someone checks the dashboard.

**Fix:** Heartbeat monitoring + alerting.

```ts
// alerting-service/src/index.ts
import { schedule } from 'node-cron';

schedule('*/5 * * * *', async () => {
  const offlineDevices = await db
    .selectFrom('devices')
    .select(['id', 'name', 'last_seen'])
    .where('last_seen', '<', new Date(Date.now() - 600000)) // 10 min threshold
    .where('status', '=', 'online')
    .execute();

  for (const device of offlineDevices) {
    logger.warn({ deviceId: device.id }, 'Device missed heartbeat');

    await db.insertInto('alerts').values({
      device_id: device.id,
      type: 'heartbeat_missed',
      severity: 'warning',
      message: `Device ${device.name} hasn't reported in > 10 minutes`,
      created_at: new Date(),
    }).execute();

    await notifyOpsTeam({
      deviceId: device.id,
      alert: 'heartbeat_missed',
    });
  }
});
```

Every 5 minutes, the system checks for devices that missed their heartbeat. Alerts are created and ops is notified.

---

## Pain #4: Anomalous Data Goes Unnoticed

A sensor reports temperature of 500°C. It's clearly faulty. No one notices until the data is reviewed next week.

**Fix:** Real-time anomaly alerting.

```ts
// telemetry-ingestion-service/src/alerts.ts
async function checkAnomalies(deviceId: string, telemetry: TelemetryPayload) {
  const rules = await db
    .selectFrom('alert_rules')
    .selectAll()
    .where('device_id', '=', deviceId)
    .execute();

  for (const rule of rules) {
    const value = telemetry[rule.metric as keyof TelemetryPayload];
    if (value === undefined) continue;

    const triggered =
      (rule.operator === '>' && value > rule.threshold) ||
      (rule.operator === '<' && value < rule.threshold);

    if (triggered) {
      logger.error({
        deviceId,
        metric: rule.metric,
        value,
        threshold: rule.threshold,
      }, 'Alert rule triggered');

      await db.insertInto('alerts').values({
        device_id: deviceId,
        type: 'threshold_violation',
        severity: rule.severity,
        message: `${rule.metric} = ${value} (threshold: ${rule.operator} ${rule.threshold})`,
        created_at: new Date(),
      }).execute();

      if (rule.severity === 'critical') {
        await pageOnCallEngineer({ deviceId, rule });
      }
    }
  }
}
```

Rules like "temperature > 100°C = warning" or "battery < 5% = critical" are evaluated on every telemetry message. Critical alerts page the on-call engineer.

---

## Pain #5: Services Are Coupled

The registry, telemetry ingestion, command dispatch, and alerting all run in one process. A memory leak in telemetry ingestion crashes the command service. Devices can't be rebooted.

**Fix:** Service split with MQTT as backbone.

```ts
// registry-service/src/index.ts
import express from 'express';
const app = express();

app.post('/devices', async (req, res) => {
  // Register device in DB
  // Publish event to MQTT for other services
  mqttClient.publish('events/device/registered', JSON.stringify(req.body));
  res.json({ status: 'registered' });
});

// telemetry-ingestion-service/src/index.ts
// Only handles MQTT → DB
// Scales independently

// alerting-service/src/index.ts
// Subscribes to telemetry topics
// Scales independently

// command-service/src/index.ts
// Only handles HTTP → MQTT commands
// Scales independently
```

Each service has one responsibility. They communicate through MQTT topics. The broker handles delivery even when services restart.

---

## Pain #6: MQTT Messages Are Lost on Crash

The telemetry ingestion service crashes while processing a batch. Those messages are lost.

**Fix:** QoS 1 + persistent sessions.

```ts
const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  clientId: 'telemetry-ingestion-1',
  clean: false, // persistent session
});

client.on('connect', () => {
  // QoS 1 = at-least-once delivery
  client.subscribe('devices/+/telemetry', { qos: 1 });
});
```

With `clean: false` and QoS 1, the broker stores messages for the client while it's offline. No telemetry is lost during deployments or crashes.

---

## Final Checklist

- [ ] MQTT broker: push-based, no polling
- [ ] Telemetry ingestion: subscribe to topics, write to DB
- [ ] Command dispatch: HTTP → MQTT, persistent commands
- [ ] Heartbeat monitoring: detect silent devices
- [ ] Anomaly alerting: threshold rules, severity levels
- [ ] Service split: registry, telemetry, commands, alerting
- [ ] QoS 1: at-least-once message delivery
- [ ] Persistent sessions: survive service restarts
- [ ] Device validation: ID format, type enum, payload schema
- [ ] Structured logging: every telemetry point, command, alert
- [ ] Environment-based config: broker URL, DB connection, thresholds

This is a production IoT device manager. It started as a naive HTTP registry. Now it's a real-time, multi-service system with MQTT messaging, telemetry ingestion, command dispatch, heartbeat monitoring, and anomaly alerting.
