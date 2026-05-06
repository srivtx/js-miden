import { PresenceInfo } from '../types/index.js';

export class PresenceService {
  private presence: Map<string, PresenceInfo> = new Map();
  private subscribers: Set<(presence: PresenceInfo[]) => void> = new Set();

  updatePresence(info: PresenceInfo): void {
    this.presence.set(info.peerId, info);
    this.notifySubscribers();
  }

  removePresence(peerId: string): void {
    this.presence.delete(peerId);
    this.notifySubscribers();
  }

  getPresence(peerId: string): PresenceInfo | null {
    return this.presence.get(peerId) || null;
  }

  getAllPresence(): PresenceInfo[] {
    return Array.from(this.presence.values());
  }

  getOnlinePeers(): string[] {
    return Array.from(this.presence.values())
      .filter(p => p.status === 'online')
      .map(p => p.peerId);
  }

  cleanupStalePresence(timeoutMs = 60000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [peerId, info] of this.presence) {
      if (now - info.lastSeen > timeoutMs) {
        this.presence.delete(peerId);
        cleaned++;
      }
    }
    if (cleaned > 0) this.notifySubscribers();
    return cleaned;
  }

  subscribe(callback: (presence: PresenceInfo[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    const all = this.getAllPresence();
    for (const cb of this.subscribers) {
      cb(all);
    }
  }
}