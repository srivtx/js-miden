import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  storagePath: process.env.STORAGE_PATH || './data/videos',
  cdnBaseUrl: process.env.CDN_BASE_URL || 'http://localhost:8080',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE) || 1024 * 1024 * 1024, // 1GB
  streamChunkSize: Number(process.env.STREAM_CHUNK_SIZE) || 1024 * 1024, // 1MB
  allowedFormats: ['mp4', 'mov', 'mkv', 'webm'],
  hlsSegmentDuration: 6, // seconds
  dashSegmentDuration: 6, // seconds
};
