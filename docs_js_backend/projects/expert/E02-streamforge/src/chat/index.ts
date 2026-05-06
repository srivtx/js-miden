import express from 'express';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/streamforge_chat');

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.connect();

// Chat message model - but NOT used in WebSocket handler (BUG)
const chatSchema = new mongoose.Schema({
  channelId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

const ChatMessage = mongoose.model('ChatMessage', chatSchema);

const server = app.listen(PORT, () => {
  console.log(`Chat Service running on port ${PORT}`);
});

const wss = new WebSocketServer({ server, path: '/ws' });

// Store active connections per channel
const channels: Map<string, Set<any>> = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const channelId = url.searchParams.get('channel') || 'default';

  // Add to channel
  if (!channels.has(channelId)) {
    channels.set(channelId, new Set());
  }
  channels.get(channelId)!.add(ws);

  // Send recent messages - BUG: Not fetching from database
  // Messages are lost on reconnect because they're never persisted
  ws.send(JSON.stringify({
    type: 'system',
    message: 'Connected to chat',
  }));

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      // BUG: Not persisting messages to database
      // await ChatMessage.create({
      //   channelId,
      //   userId: message.userId,
      //   username: message.username,
      //   message: message.message,
      // });

      // Broadcast to channel
      const channelClients = channels.get(channelId) || new Set();
      channelClients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'chat',
            username: message.username,
            message: message.message,
            timestamp: new Date().toISOString(),
          }));
        }
      });

      // Publish to Redis for cross-instance sync
      await redis.publish('chat:message', JSON.stringify({
        channelId,
        username: message.username,
        message: message.message,
      }));
    } catch (error) {
      console.error('Chat error:', error);
    }
  });

  ws.on('close', () => {
    channels.get(channelId)?.delete(ws);
  });
});

// Subscribe to Redis for cross-instance chat
redis.subscribe('chat:message', (message) => {
  const data = JSON.parse(message);
  const channelClients = channels.get(data.channelId) || new Set();
  channelClients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'chat',
        username: data.username,
        message: data.message,
        timestamp: new Date().toISOString(),
      }));
    }
  });
});

// REST API for chat history - but returns empty because messages aren't persisted
app.get('/history/:channelId', async (req, res) => {
  try {
    // This would work if messages were persisted
    const messages = await ChatMessage.find({ channelId: req.params.channelId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ messages });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'chat', connections: wss.clients.size });
});
