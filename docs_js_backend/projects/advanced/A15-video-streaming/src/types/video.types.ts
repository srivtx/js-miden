export interface Video {
  id: string;
  title: string;
  description: string;
  duration: number; // seconds
  format: string;
  size: number; // bytes
  status: VideoStatus;
  createdAt: Date;
  updatedAt: Date;
  variants: VideoVariant[];
}

export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export interface VideoVariant {
  id: string;
  videoId: string;
  quality: string; // '1080p', '720p', etc.
  bitrate: number;
  width: number;
  height: number;
  url: string;
  format: 'hls' | 'dash' | 'mp4';
}

export interface UploadSession {
  id: string;
  videoId: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBytes: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
}

export interface WatchHistoryEntry {
  id: string;
  userId: string;
  videoId: string;
  position: number; // seconds
  duration: number;
  watchedAt: Date;
}
