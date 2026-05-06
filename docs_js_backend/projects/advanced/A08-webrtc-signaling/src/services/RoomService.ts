import { Room, Peer } from '../types/index.js';
import { SignalingService } from './SignalingService.js';

export class RoomService {
  private rooms: Map<string, Room> = new Map();
  private roomPeerCounts: Map<string, number> = new Map();

  constructor(private signalingService: SignalingService) {}

  getOrCreateRoom(roomId: string, maxPeers = 8): Room {
    if (!this.rooms.has(roomId)) {
      const room: Room = {
        id: roomId,
        peers: new Set(),
        createdAt: Date.now(),
        maxPeers,
      };
      this.rooms.set(roomId, room);
      this.roomPeerCounts.set(roomId, 0);
    }
    return this.rooms.get(roomId)!;
  }

  getRoomStats(roomId: string): { peerCount: number; maxPeers: number; createdAt: number } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      peerCount: room.peers.size,
      maxPeers: room.maxPeers,
      createdAt: room.createdAt,
    };
  }

  getAllRoomStats(): Array<{ roomId: string; peerCount: number; maxPeers: number }> {
    return Array.from(this.rooms.values()).map(room => ({
      roomId: room.id,
      peerCount: room.peers.size,
      maxPeers: room.maxPeers,
    }));
  }

  cleanupEmptyRooms(): number {
    let cleaned = 0;
    for (const [roomId, room] of this.rooms) {
      if (room.peers.size === 0) {
        this.rooms.delete(roomId);
        this.roomPeerCounts.delete(roomId);
        cleaned++;
      }
    }
    return cleaned;
  }
}