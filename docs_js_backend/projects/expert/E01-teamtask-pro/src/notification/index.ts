import express from 'express';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.connect();

// Store active SSE connections
// BUG: Connections not scoped by tenant - real-time events leak to wrong tenant
const connections: Map<string, any> = new Map();

app.get('/events', async (req, res) => {
  const token = req.query.token as string;
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  // Verify token (simplified)
  try {
    // In real app, verify JWT here
    const userId = 'decoded-user-id';
    const organizationId = req.query.org as string; // BUG: Trusting query param for org

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const connId = `${userId}-${Date.now()}`;
    connections.set(connId, { res, organizationId });

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    req.on('close', () => {
      connections.delete(connId);
    });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Publish endpoint for internal services
app.post('/publish', async (req, res) => {
  const { organizationId, event, data } = req.body;

  // BUG: Broadcasting to ALL connections instead of filtering by organizationId
  connections.forEach((conn) => {
    conn.res.write(`data: ${JSON.stringify({ event, data, organizationId })}\n\n`);
  });

  // Also publish to Redis for other notification service instances
  await redis.publish('notifications', JSON.stringify({ organizationId, event, data }));

  res.json({ published: true, connections: connections.size });
});

// Subscribe to Redis for cross-instance messaging
redis.subscribe('notifications', (message) => {
  const { organizationId, event, data } = JSON.parse(message);
  // BUG: Same leak - broadcasting to all connections without filtering
  connections.forEach((conn) => {
    conn.res.write(`data: ${JSON.stringify({ event, data, organizationId })}\n\n`);
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification', connections: connections.size });
});

app.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
});
