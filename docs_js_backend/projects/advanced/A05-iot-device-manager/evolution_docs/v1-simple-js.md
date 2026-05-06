# v1 — The Naive IoT Registry (Pure JS)

You need to manage IoT devices. You build a simple registry.

```js
const express = require('express');
const app = express();
app.use(express.json());

const devices = new Map();

app.post('/devices', (req, res) => {
  const { id, name, type } = req.body;
  devices.set(id, { id, name, type, status: 'offline' });
  res.json({ status: 'registered' });
});

app.get('/devices/:id', (req, res) => {
  res.json(devices.get(req.params.id) || { error: 'Not found' });
});

app.patch('/devices/:id/status', (req, res) => {
  const device = devices.get(req.params.id);
  if (!device) return res.status(404).send();
  device.status = req.body.status;
  res.json({ status: 'updated' });
});

app.listen(3000);
```

You register a device. You check its status. Simple.

## Then the Pain Hits

**Polling doesn't scale.** 10,000 devices polling every 5 seconds = 2,000 req/s of "what's my status?" Your server melts.

**No telemetry.** A device is supposed to send temperature every minute. It hasn't sent anything in an hour. You don't know.

**No commands.** You want to tell a device to reboot. There's no mechanism. You email the user and ask them to power cycle it.

**No alerting.** A device reports temperature of 200°C. It's on fire. You find out when the building burns down.

## The Realization

You need:
1. **MQTT or WebSockets** — push, not poll
2. **Telemetry ingestion** — collect and store device data
3. **Command dispatch** — send instructions to devices
4. **Alerting** — react to anomalous data in real-time

But IoT is a different paradigm. The evolution will force you to split device registry from telemetry ingestion and build a command pipeline.
