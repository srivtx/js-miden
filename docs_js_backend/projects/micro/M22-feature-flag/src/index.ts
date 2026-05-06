import express from 'express';
import { FeatureFlagService } from './feature-flag.js';

const app = express();
app.use(express.json());

const service = new FeatureFlagService();

// Seed some flags
service.setFlag({ name: 'dark-mode', enabled: true, rolloutPercentage: 10 });
service.setFlag({ name: 'new-checkout', enabled: false, rolloutPercentage: 0 });

app.get('/flags/:flag', (req, res) => {
  const { flag } = req.params;
  const userId = req.query.userId as string | undefined;
  const enabled = service.isEnabled(flag, userId);
  const flagConfig = service.getFlag(flag);

  res.json({
    flag,
    enabled,
    userId,
    rolloutPercentage: flagConfig?.rolloutPercentage ?? 0,
  });
});

app.get('/flags', (req, res) => {
  const userId = req.query.userId as string | undefined;
  const flags = service.getAllFlags().map(f => ({
    name: f.name,
    enabled: service.isEnabled(f.name, userId),
    rolloutPercentage: f.rolloutPercentage,
  }));
  res.json({ flags });
});

app.post('/flags/:flag', (req, res) => {
  const { flag } = req.params;
  const { enabled, rolloutPercentage, userIds } = req.body;
  service.setFlag({ name: flag, enabled, rolloutPercentage, userIds });
  res.json({ flag, enabled, rolloutPercentage });
});

export { app, service };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Feature flag service running on port ${PORT}`);
  });
}
