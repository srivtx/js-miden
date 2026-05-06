import express from 'express';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4003;

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/streamforge_analytics');

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.connect();

// Analytics models
const viewerSchema = new mongoose.Schema({
  channelId: { type: String, required: true, index: true },
  streamKey: { type: String, required: true },
  viewerId: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
});

const Viewer = mongoose.model('Viewer', viewerSchema);

const donationSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  donorId: { type: String, required: true },
  amount: { type: Number, required: true },
  message: { type: String },
  currency: { type: String, default: 'USD' },
}, { timestamps: true });

const Donation = mongoose.model('Donation', donationSchema);

const subscriptionSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  subscriberId: { type: String, required: true },
  tier: { type: String, enum: ['tier1', 'tier2', 'tier3'], default: 'tier1' },
  status: { type: String, enum: ['active', 'canceled'], default: 'active' },
}, { timestamps: true });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

// Viewer count using Redis - BUG: Race condition in increment/decrement
app.post('/viewers/join', async (req, res) => {
  try {
    const { channelId, streamKey, viewerId } = req.body;

    // BUG: Race condition here - two simultaneous joins can result in incorrect count
    const currentCount = await redis.get(`viewers:${channelId}`);
    const newCount = (parseInt(currentCount || '0', 10)) + 1;
    await redis.set(`viewers:${channelId}`, newCount.toString());

    // Also record in DB for analytics
    await Viewer.create({ channelId, streamKey, viewerId });

    // Publish viewer count update
    await redis.publish('analytics:viewers', JSON.stringify({
      channelId,
      count: newCount,
    }));

    res.json({ count: newCount });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/viewers/leave', async (req, res) => {
  try {
    const { channelId, viewerId } = req.body;

    // BUG: Race condition here - simultaneous leaves can result in negative count
    const currentCount = await redis.get(`viewers:${channelId}`);
    const newCount = Math.max(0, (parseInt(currentCount || '0', 10)) - 1);
    await redis.set(`viewers:${channelId}`, newCount.toString());

    // Update viewer record
    await Viewer.findOneAndUpdate(
      { channelId, viewerId, leftAt: { $exists: false } },
      { leftAt: new Date() }
    );

    await redis.publish('analytics:viewers', JSON.stringify({
      channelId,
      count: newCount,
    }));

    res.json({ count: newCount });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/viewers/:channelId', async (req, res) => {
  try {
    const count = await redis.get(`viewers:${req.params.channelId}`);
    res.json({ channelId: req.params.channelId, count: parseInt(count || '0', 10) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Donations
app.post('/donations', async (req, res) => {
  try {
    const donation = await Donation.create(req.body);
    await redis.publish('analytics:donation', JSON.stringify(donation));
    res.status(201).json({ donation });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/donations/:channelId', async (req, res) => {
  try {
    const donations = await Donation.find({ channelId: req.params.channelId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ donations });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Subscriptions
app.post('/subscriptions', async (req, res) => {
  try {
    const subscription = await Subscription.create(req.body);
    res.status(201).json({ subscription });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/subscriptions/:channelId', async (req, res) => {
  try {
    const count = await Subscription.countDocuments({
      channelId: req.params.channelId,
      status: 'active',
    });
    res.json({ channelId: req.params.channelId, subscriberCount: count });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Stream analytics
app.get('/stream/:streamKey', async (req, res) => {
  try {
    const viewers = await Viewer.countDocuments({
      streamKey: req.params.streamKey,
      leftAt: { $exists: false },
    });

    const peakViewers = await Viewer.countDocuments({
      streamKey: req.params.streamKey,
    });

    res.json({
      streamKey: req.params.streamKey,
      currentViewers: viewers,
      totalUniqueViewers: peakViewers,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'analytics' });
});

app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
});
