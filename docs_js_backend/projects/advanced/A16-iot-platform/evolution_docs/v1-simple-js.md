# v1 — Simple JS (Naive IoT Platform)

## The Scenario

It's 2am. Your junior just deployed their first IoT platform. "Devices can send data!" they say. You ask how you know which device sent what. They say "the device tells us its ID." You ask about authentication. They blink.

## The PAIN: Trust-By-Assertion

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const devices = {}; // <-- Devices register themselves. No proof required.
const telemetry = []; // <-- Data lives here. Unvalidated. Unauthenticated.

app.post('/register', (req, res) => {
  const { deviceId, name } = req.body;
  devices[deviceId] = { name, registeredAt: new Date() };
  res.json({ success: true });
});

app.post('/telemetry', (req, res) => {
  const { deviceId, temperature, humidity } = req.body;
  // Anyone can send data as any device. We just believe them.
  telemetry.push({ deviceId, temperature, humidity, timestamp: new Date() });
  res.json({ success: true });
});

app.post('/command', (req, res) => {
  const { deviceId, command } = req.body;
  // Anyone can send commands to any device. Reboot the pacemaker? Sure.
  res.json({ sent: true, deviceId, command });
});

app.listen(3000);
```

### What breaks in production:

1. **Device spoofing**: Attacker sends `deviceId: 'thermostat-001'` with fake temperature data. Your HVAC system overheats a building because it trusts unauthenticated input.

2. **Unauthorized commands**: Attacker sends `command: 'reboot'` to `deviceId: 'pacemaker-42'`. There is no authentication on the command endpoint.

3. **No time-series storage**: Telemetry is stored in an array. Querying "average temperature last week" requires scanning every data point. At 10,000 devices sending data every second, this array has 6 billion entries per week.

4. **No MQTT broker**: Devices poll HTTP endpoints every second. That's 10,000 HTTP requests per second just to check for commands. Battery life measured in hours.

5. **Data loss on restart**: The `telemetry` array lives in RAM. Deploy a new version? Every sensor reading vanishes. Your analytics pipeline is empty.

### The moment of realization:

> Junior: "Why is the factory shutting down? The temperature sensors say everything is fine."
>
> You: "Because an attacker spoofed `thermostat-001` and sent 20°C readings while the actual temperature was 120°C. You built a system that trusts whatever ID a client claims. In IoT, the device is not your friend until it proves its identity."

## Why we start here

This is how developers build their first IoT platform. It's simple. It receives JSON. And it's completely unsuitable for any real device deployment. We keep this version to remember the pain — so we understand why device authentication, MQTT, and time-series databases exist.

## The fix (next version)

We need types to prevent `req.body.temperatre` from being silently ignored. But more importantly, we need **device authentication** — because in IoT, every unauthenticated endpoint is a physical vulnerability.
