# v1 — The Naive Manual Scaling (Pure JS)

You run a web service on three servers. Traffic spikes unpredictably. You write a script to add nodes manually.

```js
const express = require('express');
const app = express();

const nodes = [
  { id: 'node-1', status: 'running', cpu: 45 },
  { id: 'node-2', status: 'running', cpu: 52 },
  { id: 'node-3', status: 'running', cpu: 38 },
];

app.use(express.json());

app.get('/status', (req, res) => {
  res.json({ nodes });
});

app.post('/scale/up', (req, res) => {
  const newNode = { id: `node-${nodes.length + 1}`, status: 'running', cpu: 0 };
  nodes.push(newNode);
  res.json({ added: newNode });
});

app.post('/scale/down', (req, res) => {
  const nodeId = req.body.nodeId;
  const idx = nodes.findIndex(n => n.id === nodeId);
  if (idx > -1) nodes.splice(idx, 1);
  res.json({ removed: nodeId });
});

app.listen(3000, () => console.log('Scaling console on 3000'));
```

Check CPU. Click "scale up" or "scale down". Done.

## Then the Pain Hits

**3 AM page.** Traffic spikes while you're asleep. Your servers are at 95% CPU. Response times hit 30 seconds. Customers tweet about the outage. You wake up to a disaster.

**Over-provisioning.** To avoid the 3 AM page, you run 10 nodes 24/7. Your cloud bill is $15,000/month. On weekends, utilization is 5%. You're burning money.

**No cooldown.** You add a node. It takes 2 minutes to warm up. During those 2 minutes, CPU is still high, so you add another. Then another. Now you have 8 nodes for a 3-node workload. You scale down. CPU spikes. You scale up again. Infinite oscillation.

**No prediction.** Black Friday is coming. You guess you need 20 nodes. You provision 20. Traffic is actually 40 nodes worth. The site crashes. Or traffic is 10 nodes worth. You waste money.

**No cost awareness.** You scale to the biggest instance type because it's "safe". You never analyze whether 4 medium instances would be cheaper than 2 larges.

## The Realization

Manual scaling is fine for a blog. For a production platform, you need:
1. **Threshold-based scaling** — automate reactions to metrics
2. **Cooldown** — prevent thrashing
3. **Predictive scaling** — forecast load before it hits
4. **Hysteresis** — separate scale-up and scale-down thresholds
5. **Cost optimization** — bin packing, right-sizing, spot instances

This is where the evolution starts.
