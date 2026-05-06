import { Video, VideoVariant, UploadSession } from '../types/video.types.js';

// In-memory store (production: use database)
const videos = new Map<string, Video>();
const uploads = new Map<string, UploadSession>();

export class VideoService {
  async createVideo(data: Omit<Video, 'id' | 'createdAt' | 'updatedAt' | 'variants' | 'status'>): Promise<Video> {
    const video: Video = {
      ...data,
      id: crypto.randomUUID(),
      status: 'uploading',
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    videos.set(video.id, video);
    return video;
  }

  async getVideo(id: string): Promise<Video | null> {
    return videos.get(id) || null;
  }

  async updateStatus(id: string, status: Video['status']): Promise<Video | null> {
    const video = videos.get(id);
    if (!video) return null;
    video.status = status;
    video.updatedAt = new Date();
    videos.set(id, video);
    return video;
  }

  async addVariant(videoId: string, variant: VideoVariant): Promise<Video | null> {
    const video = videos.get(videoId);
    if (!video) return null;
    video.variants.push(variant);
    video.updatedAt = new Date();
    videos.set(videoId, video);
    return video;
  }

  async createUploadSession(videoId: string, filename: string, mimeType: string, size: number): Promise<UploadSession> {
    const session: UploadSession = {
      id: crypto.randomUUID(),
      videoId,
      filename,
      mimeType,
      size,
      uploadedBytes: 0,
      status: 'pending',
      createdAt: new Date(),
    };
    uploads.set(session.id, session);
    return session;
  }

  async getUploadSession(id: string): Promise<UploadSession | null> {
    return uploads.get(id) || null;
  }

  async updateUploadProgress(id: string, bytes: number): Promise<UploadSession | null> {
    const session = uploads.get(id);
    if (!session) return null;
    session.uploadedBytes += bytes;
    if (session.uploadedBytes >= session.size) {
      session.status = 'completed';
    } else {
      session.status = 'in_progress';
    }
    uploads.set(id, session);
    return session;
  }
}

export const videoService = new VideoService();
