# v2 — Adding TypeScript

You just debugged why a device status update failed silently.

```js
app.patch('/devices/:id/status', (req, res) => {
  const device = devices.get(req.params.id);
  device.status = req.body.status;
  res.json({ status: 'updated' });
});
```

The device sent `{ "status": "onlline" }` (typo). Your code accepted it. Now the device shows status "onlline" in the database. The frontend checks for `"online"`. It shows offline. TypeScript would have caught this with a union type.

## The Fix: Types

```ts
type DeviceStatus = 'online' | 'offline' | 'sleeping' | 'error';
type DeviceType = 'sensor' | 'actuator' | 'gateway';

interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  lastSeen: Date;
}

app.patch('/devices/:id/status', (req, res) => {
  const device = devices.get(req.params.id);
  if (!device) return res.status(404).send();

  const status: DeviceStatus = req.body.status;
  device.status = status;
  res.json({ status: 'updated' });
});
```

Now `"onlline"` is a compile-time error. Only valid statuses are accepted.

## But Wait...

TypeScript doesn't make devices stop polling. It doesn't ingest telemetry. It just prevents invalid status strings.

**Next:** Let's add validation so malformed device data is rejected.
