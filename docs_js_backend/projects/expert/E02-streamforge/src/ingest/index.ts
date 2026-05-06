import express from 'express';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/streamforge_ingest');

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.connect();

// Stream model
const streamSchema = new mongoose.Schema({
  streamKey: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['live', 'offline', 'ended'], default: 'offline' },
  startedAt: { type: Date },
  endedAt: { type: Date },
  rtmpUrl: { type: String },
}, { timestamps: true });

const Stream = mongoose.model('Stream', streamSchema);

// BUG: Stream tokens not validated - anyone can generate a stream key
app.post('/streams/start', async (req: any, res) => {
  try {
    const { channelId, title } = req.body;
    // BUG: No token validation - no authentication required
    // BUG: No verification that user owns the channelId

    const streamKey = uuidv4();
    const rtmpUrl = `rtmp://localhost:1935/live/${streamKey}`;

    const stream = await Stream.create({
      streamKey,
      userId: req.body.userId || 'anonymous', // BUG: Accepting userId from body
      channelId,
      title,
      status: 'live',
      startedAt: new Date(),
      rtmpUrl,
    });

    // Notify transcode service
    await redis.publish('stream:start', JSON.stringify({
      streamKey,
      channelId,
      rtmpUrl,
    }));

    res.status(201).json({ stream });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/streams/:streamKey/end', async (req, res) => {
  try {
    const stream = await Stream.findOneAndUpdate(
      { streamKey: req.params.streamKey },
      { status: 'ended', endedAt: new Date() },
      { new: true }
    );

    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    await redis.publish('stream:end', JSON.stringify({
      streamKey: req.params.streamKey,
    }));

    res.json({ stream });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/streams/:channelId', async (req, res) => {
  try {
    const stream = await Stream.findOne({
      channelId: req.params.channelId,
      status: 'live',
    }).sort({ createdAt: -1 });

    if (!stream) {
      return res.status(404).json({ error: 'No active stream' });
    }

    res.json({ stream });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Validate stream key for RTMP server
app.get('/streams/validate/:streamKey', async (req, res) => {
  try {
    // BUG: Always returns valid - no actual validation
    res.json({ valid: true, streamKey: req.params.streamKey });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ingest' });
});

app.listen(PORT, () => {
  console.log(`Ingest Service running on port ${PORT}`);
});
