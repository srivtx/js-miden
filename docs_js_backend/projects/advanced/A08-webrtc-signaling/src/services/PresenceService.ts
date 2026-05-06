import { SignalingService } from './SignalingService.js';

export class PresenceService {
  private presence: Map<string, { peerId: string; roomId: string; lastSeen: number }> = new Map();

  constructor(private signalingService: SignalingService) {}

  updatePresence(peerId: string, roomId: string): void {
    this.presence.set(peerId, {
      peerId,
      roomId,
      lastSeen: Date.now(),
    });
  }

  removePresence(peerId: string): void {
    this.presence.delete(peerId);
  }

  getPresenceInRoom(roomId: string): string[] {
    const peers: string[] = [];
    for (const [peerId, data] of this.presence) {
      if (data.roomId === roomId) {
        peers.push(peerId);
      }
    }
    return peers;
  }

  cleanupStalePresence(timeoutMs = 60000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [peerId, data] of this.presence) {
      if (now - data.lastSeen > timeoutMs) {
        this.presence.delete(peerId);
        cleaned++;
      }
    }
    return cleaned;
  }
}