import express from 'express';
import fs from 'fs';
import path from 'path';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(express.json());

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.connect();

const STORAGE_PATH = process.env.STORAGE_PATH || './streams';

interface TranscodeJob {
  streamKey: string;
  channelId: string;
  rtmpUrl: string;
  qualities: string[];
}

// Simulate transcoding to multiple qualities
const QUALITIES = ['1080p', '720p', '480p', '360p'];

async function processTranscode(job: TranscodeJob) {
  const streamDir = path.join(STORAGE_PATH, job.channelId, job.streamKey);
  if (!fs.existsSync(streamDir)) {
    fs.mkdirSync(streamDir, { recursive: true });
  }

  for (const quality of QUALITIES) {
    const qualityDir = path.join(streamDir, quality);
    if (!fs.existsSync(qualityDir)) {
      fs.mkdirSync(qualityDir, { recursive: true });
    }

    // Generate HLS playlist
    const playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000,
segment_0.ts
#EXTINF:6.000,
segment_1.ts
#EXT-X-ENDLIST
`;

    fs.writeFileSync(path.join(qualityDir, 'playlist.m3u8'), playlist);

    // Simulate segment files
    fs.writeFileSync(path.join(qualityDir, 'segment_0.ts'), '');
    fs.writeFileSync(path.join(qualityDir, 'segment_1.ts'), '');
  }

  // Generate master playlist
  const masterPlaylist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
480p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/playlist.m3u8
`;

  fs.writeFileSync(path.join(streamDir, 'master.m3u8'), masterPlaylist);

  await redis.publish('transcode:complete', JSON.stringify({
    streamKey: job.streamKey,
    channelId: job.channelId,
    playlistUrl: `/streams/${job.channelId}/${job.streamKey}/master.m3u8`,
  }));
}

// Subscribe to stream start events
redis.subscribe('stream:start', async (message) => {
  const data = JSON.parse(message);
  console.log('Starting transcode for stream:', data.streamKey);

  const job: TranscodeJob = {
    streamKey: data.streamKey,
    channelId: data.channelId,
    rtmpUrl: data.rtmpUrl,
    qualities: QUALITIES,
  };

  await processTranscode(job);
});

// Serve HLS playlists and segments
app.use('/streams', express.static(STORAGE_PATH));

// Get stream playlist
app.get('/playlist/:channelId/:streamKey', (req, res) => {
  const playlistPath = path.join(STORAGE_PATH, req.params.channelId, req.params.streamKey, 'master.m3u8');
  if (!fs.existsSync(playlistPath)) {
    return res.status(404).json({ error: 'Playlist not found' });
  }
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.sendFile(playlistPath);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'transcode' });
});

app.listen(PORT, () => {
  console.log(`Transcode Service running on port ${PORT}`);
});
