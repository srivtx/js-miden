import { WatchHistoryEntry } from '../types/video.types.js';

const history = new Map<string, WatchHistoryEntry[]>();

export class HistoryService {
  async recordWatch(userId: string, videoId: string, position: number, duration: number): Promise<WatchHistoryEntry> {
    const entry: WatchHistoryEntry = {
      id: crypto.randomUUID(),
      userId,
      videoId,
      position,
      duration,
      watchedAt: new Date(),
    };

    const userHistory = history.get(userId) || [];
    userHistory.push(entry);
    history.set(userId, userHistory);

    return entry;
  }

  async getHistory(userId: string): Promise<WatchHistoryEntry[]> {
    return history.get(userId) || [];
  }

  async getWatchProgress(userId: string, videoId: string): Promise<number> {
    const userHistory = history.get(userId) || [];
    const entry = userHistory.find((h) => h.videoId === videoId);
    return entry?.position || 0;
  }
}

export const historyService = new HistoryService();
